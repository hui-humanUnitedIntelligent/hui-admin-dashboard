'use client';
import { useRouter } from 'next/navigation';
// frontend/src/app/admins/page.tsx

import { isSuperAdmin } from '@/lib/roles';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Badge from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string;
  email: string | null;
  last_seen: string | null;
  created_at: string;
  membership_type: string | null;
  is_wirker: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30) return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}

function avatarColor(id: string) {
  const c = ['#4ECDC4','#F7B731','#B197FC','#74C0FC','#51CF66','#FF6B6B','#FFA94D','#DA77F2'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'superadmin') return <Badge variant="danger">👑 Superadmin</Badge>;
  if (role === 'admin')      return <Badge variant="warning">🛡️ Admin</Badge>;
  return <Badge variant="neutral">{role}</Badge>;
}

async function adminAction(action: string, userId: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId, data }),
    });
    return res.ok;
  } catch { return false; }
}

async function fetchAdmins(): Promise<AdminUser[]> {
  const res = await fetch('/api/admin?table=profiles&select=id,display_name,username,avatar_url,role,email,last_seen,created_at,membership_type,is_wirker&limit=500');
  if (!res.ok) return [];
  const all: AdminUser[] = await res.json();
  return all.filter(u => u.role === 'admin' || u.role === 'superadmin');
}

async function searchUsers(q: string): Promise<AdminUser[]> {
  if (!q.trim()) return [];
  const res = await fetch(`/api/admin?table=profiles&select=id,display_name,username,avatar_url,role,email,last_seen,created_at,membership_type,is_wirker&limit=200`);
  if (!res.ok) return [];
  const all: AdminUser[] = await res.json();
  const lower = q.toLowerCase();
  return all.filter(u =>
    u.role !== 'admin' && u.role !== 'superadmin' &&
    (
      (u.display_name || '').toLowerCase().includes(lower) ||
      (u.username || '').toLowerCase().includes(lower) ||
      (u.email || '').toLowerCase().includes(lower)
    )
  ).slice(0, 15);
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <tr>
      {[...Array(5)].map((_, i) => (
        <td key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 13, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: i === 0 ? '70%' : '50%' }} />
        </td>
      ))}
    </tr>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function AdminsPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isSuperAdmin(currentUser?.role)) router.replace("/dashboard");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role]);
  if (!isSuperAdmin(currentUser?.role)) return null;

  const userRole = currentUser?.role;
  const [admins, setAdmins]         = useState<AdminUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [addSearch, setAddSearch]   = useState('');
  const [results, setResults]       = useState<AdminUser[]>([]);
  const [searching, setSearching]   = useState(false);
  const [addRole, setAddRole]       = useState<'admin' | 'superadmin'>('admin');
  const [busy, setBusy]             = useState<Record<string, boolean>>({});
  const [confirm, setConfirm]       = useState<{
    open: boolean; title: string; msg: string; fn: () => Promise<void>; loading: boolean;
  }>({ open: false, title: '', msg: '', fn: async () => {}, loading: false });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAdmins();
    setAdmins(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Search for users to add
  useEffect(() => {
    if (!addSearch.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchUsers(addSearch);
      setResults(r);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [addSearch]);

  // Promote user to admin/superadmin
  const handlePromote = async (u: AdminUser, newRole: 'admin' | 'superadmin') => {
    setBusy(p => ({ ...p, [u.id]: true }));
    const ok = await adminAction('change_role', u.id, { role: newRole });
    setBusy(p => ({ ...p, [u.id]: false }));
    if (ok) {
      showToast(`✅ ${u.display_name || u.username} → ${newRole}`, 'success');
      setAddSearch('');
      setResults([]);
      load();
    } else {
      showToast('Fehler beim Befördern', 'error');
    }
  };

  // Change role of existing admin
  const handleChangeRole = (u: AdminUser, newRole: string) => {
    setConfirm({
      open: true, loading: false,
      title: `Rolle ändern`,
      msg: `„${u.display_name || u.username}" wird zu ${newRole} geändert.`,
      fn: async () => {
        const ok = await adminAction('change_role', u.id, { role: newRole });
        if (ok) { showToast(`Rolle geändert → ${newRole}`, 'info'); load(); }
        else showToast('Fehler', 'error');
      },
    });
  };

  // Remove admin (back to basisuser)
  const handleRemove = (u: AdminUser) => {
    const isSuperadmin = u.role === 'superadmin';
    setConfirm({
      open: true, loading: false,
      title: `🚫 Admin-Rechte entziehen`,
      msg: `„${u.display_name || u.username}" verliert alle Admin-Rechte und wird zu Basisuser herabgestuft.${isSuperadmin ? '\n\n⚠️ Achtung: Das ist ein Superadmin!' : ''}`,
      fn: async () => {
        const ok = await adminAction('change_role', u.id, { role: 'basisuser' });
        if (ok) { showToast(`${u.display_name || u.username} ist kein Admin mehr`, 'info'); load(); }
        else showToast('Fehler', 'error');
      },
    });
  };

  const fieldStyle: React.CSSProperties = {
    padding: '8px 12px', background: 'var(--bg-primary)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 13,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  const superAdmins = admins.filter(u => u.role === 'superadmin');
  const regularAdmins = admins.filter(u => u.role === 'admin');

  return (
    <DashboardLayout
      title="Admin-Verwaltung"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          
      <PageHeader
        title="Admin-Verwaltung"
        subtitle="Administratoren & Rollen verwalten"
        actionsRole="superadmin"
        userRole={userRole}
      />

<span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
            👑 {superAdmins.length} Superadmin{superAdmins.length !== 1 ? 's' : ''} · 🛡️ {regularAdmins.length} Admin{regularAdmins.length !== 1 ? 's' : ''}
          </span>
          <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Superadmins', value: superAdmins.length, color: 'var(--red)',    icon: '👑' },
          { label: 'Admins',      value: regularAdmins.length, color: 'var(--gold)', icon: '🛡️' },
          { label: 'Gesamt',      value: admins.length,       color: 'var(--accent)',icon: '⚙️' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: `1px solid var(--border)`, borderRadius: 12, padding: '16px 20px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
              {loading ? '…' : value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4 }}>
              {icon} {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Admin hinzufügen ─────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>➕</span> Admin hinzufügen
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Search input */}
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }}>🔍</span>
            <input
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              placeholder="User suchen (Name, @username oder E-Mail)…"
              style={{ ...fieldStyle, paddingLeft: 34 }}
            />
          </div>
          {/* Role selector */}
          <div>
            <select
              value={addRole}
              onChange={e => setAddRole(e.target.value as 'admin' | 'superadmin')}
              style={{ ...fieldStyle, width: 'auto', paddingRight: 28 }}
            >
              <option value="admin">🛡️ Admin</option>
              <option value="superadmin">👑 Superadmin</option>
            </select>
          </div>
        </div>

        {/* Search results */}
        {(searching || results.length > 0) && (
          <div style={{ marginTop: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {searching && (
              <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>Suche läuft…</div>
            )}
            {!searching && results.length === 0 && addSearch.trim() && (
              <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>Keine User gefunden.</div>
            )}
            {results.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(u.id), flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0F1117' }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display='none'; }}/>
                    : (u.display_name || u.username || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{u.display_name || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>@{u.username} · {u.role}</div>
                </div>
                <button
                  disabled={busy[u.id]}
                  onClick={() => handlePromote(u, addRole)}
                  style={{
                    padding: '6px 14px', borderRadius: 7, border: 'none', cursor: busy[u.id] ? 'default' : 'pointer',
                    background: addRole === 'superadmin' ? 'var(--red)' : 'var(--accent)',
                    color: '#0F1117', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)',
                    opacity: busy[u.id] ? 0.6 : 1, flexShrink: 0,
                  }}
                >
                  {busy[u.id] ? '…' : `Als ${addRole === 'superadmin' ? 'Superadmin' : 'Admin'} hinzufügen`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Admin-Tabelle ────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>👮 Aktuelle Admins & Superadmins</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{admins.length} Einträge</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['User', 'Rolle', 'Mitgliedschaft', 'Letzter Login', 'Mitglied seit', 'Aktionen'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton/><Skeleton/><Skeleton/></>
              ) : admins.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Keine Admins gefunden</td></tr>
              ) : (
                // Sort: superadmins first
                [...admins].sort((a, b) => {
                  if (a.role === 'superadmin' && b.role !== 'superadmin') return -1;
                  if (b.role === 'superadmin' && a.role !== 'superadmin') return 1;
                  return (a.display_name || '').localeCompare(b.display_name || '');
                }).map((u) => {
                  const isBusy = busy[u.id];
                  return (
                    <tr key={u.id} className="tr-hover" style={{ borderLeft: u.role === 'superadmin' ? '3px solid var(--red)' : '3px solid var(--gold)' }}>
                      {/* User */}
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(u.id), flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0F1117' }}>
                            {u.avatar_url
                              ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display='none'; }}/>
                              : (u.display_name || u.username || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{u.display_name || '—'}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>@{u.username || '—'}</div>
                          </div>
                        </div>
                      </td>
                      {/* Role — inline change */}
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        <select
                          value={u.role}
                          disabled={isBusy}
                          onChange={e => handleChangeRole(u, e.target.value)}
                          style={{
                            padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                            background: u.role === 'superadmin' ? 'rgba(255,107,107,0.12)' : 'rgba(247,183,49,0.1)',
                            border: `1px solid ${u.role === 'superadmin' ? 'var(--red)' : 'var(--gold)'}`,
                            color: u.role === 'superadmin' ? 'var(--red)' : 'var(--gold)',
                            fontFamily: 'var(--font-body)', outline: 'none', fontWeight: 600,
                          }}
                        >
                          <option value="admin">🛡️ Admin</option>
                          <option value="superadmin">👑 Superadmin</option>
                        </select>
                      </td>
                      {/* Membership */}
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11 }}>
                        {u.membership_type || '—'}
                      </td>
                      {/* Last seen */}
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11 }}>
                        {timeAgo(u.last_seen)}
                      </td>
                      {/* Created */}
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11 }}>
                        {timeAgo(u.created_at)}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                        <button
                          disabled={isBusy}
                          onClick={() => handleRemove(u)}
                          title="Admin-Rechte entziehen"
                          style={{
                            padding: '5px 12px', borderRadius: 7,
                            border: '1px solid var(--red)', background: 'var(--red-dim)',
                            color: 'var(--red)', cursor: isBusy ? 'default' : 'pointer',
                            fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)',
                            opacity: isBusy ? 0.5 : 1, whiteSpace: 'nowrap',
                          }}
                        >
                          {isBusy ? '…' : '🚫 Entfernen'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info box */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.2)', borderRadius: 10, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--accent)' }}>ℹ️ Rollen-Übersicht:</strong><br/>
        <strong>👑 Superadmin</strong> — Voller Zugriff auf alle Dashboard-Funktionen, kann andere Admins verwalten.<br/>
        <strong>🛡️ Admin</strong> — Verwaltungszugriff auf User, Werke, Buchungen und Transaktionen.<br/>
        <strong>Entfernen</strong> setzt den User auf <code>basisuser</code> zurück — alle Profildaten bleiben erhalten.
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirm.open}
        onClose={() => setConfirm(p => ({ ...p, open: false }))}
        onConfirm={async () => {
          setConfirm(p => ({ ...p, loading: true }));
          await confirm.fn();
          setConfirm(p => ({ ...p, loading: false, open: false }));
        }}
        title={confirm.title}
        message={confirm.msg}
        loading={confirm.loading}
        confirmLabel="Bestätigen"
        confirmVariant="danger"
      />
    </DashboardLayout>
  );
}
