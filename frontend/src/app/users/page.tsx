// frontend/src/app/users/page.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import EditProfileModal from '@/components/ui/EditProfileModal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useProfiles, HuiProfile } from '@/lib/hooks/useSupabase';
import { useProfilesRealtime } from '@/lib/hooks/useUserRealtime';
import { showToast } from '@/components/ui/Toast';
import {
  blockUser, unblockUser, softDeleteUser,
  changeUserRole, changeUserGroup, toggleWirkerStatus,
  UserRole, UserGroup,
} from '@/lib/actions/userActions';

const AVATAR_COLORS = ['#4ECDC4','#F7B731','#B197FC','#74C0FC','#FF6B6B','#51CF66'];
function avatarColor(id: string) {
  const code = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}
function timeAgo(iso: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30)  return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}

// ── Blocked = role === 'blocked', Deleted = trust_score === -999
function getUserStatus(u: HuiProfile): 'active' | 'blocked' | 'deleted' {
  if (u.trust_score === -999) return 'deleted';
  if (u.role === 'blocked')   return 'blocked';
  return 'active';
}

function Skeleton() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 12, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: i === 0 ? '80%' : '60%' }} />
        </td>
      ))}
    </tr>
  );
}

function InlineSelect({ value, options, onChange, disabled }: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: '3px 6px', borderRadius: 6, fontSize: 11,
        background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
        cursor: 'pointer', outline: 'none', maxWidth: 130,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function StatusBadge({ status }: { status: 'active' | 'blocked' | 'deleted' }) {
  if (status === 'blocked') return <Badge variant="danger"  dot>Blockiert</Badge>;
  if (status === 'deleted') return <Badge variant="neutral" dot>Gelöscht</Badge>;
  return <Badge variant="success" dot>Aktiv</Badge>;
}

function ActionBtn({ title, onClick, color = 'var(--text-secondary)', children, disabled }: {
  title: string; onClick: (e: React.MouseEvent) => void;
  color?: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(e); }}
      style={{
        padding: '4px 8px', borderRadius: 6,
        background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
        cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, color,
        opacity: disabled ? 0.5 : 1, transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {children}
    </button>
  );
}

export default function UsersPage() {
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [wirkerOnly, setWirkerOnly]   = useState(false);
  const [page, setPage]               = useState(0);
  const [selected, setSelected]       = useState<HuiProfile | null>(null);
  const [editModal, setEditModal]     = useState(false);
  const [busy, setBusy]               = useState<Record<string, boolean>>({});
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void; loading: boolean;
  }>({ open: false, title: '', message: '', onConfirm: () => {}, loading: false });

  const LIMIT = 50;

  const { profiles, total, loading, refetch } = useProfiles({
    search, role: roleFilter, page, limit: LIMIT, refreshInterval: 15000,
  });

  // Supabase Realtime → auto-refresh on any change
  useProfilesRealtime(refetch, true);

  const filtered = useMemo(() => {
    let res = wirkerOnly ? profiles.filter((p) => p.is_wirker) : profiles;
    if (statusFilter === 'blocked') res = res.filter((p) => getUserStatus(p) === 'blocked');
    if (statusFilter === 'active')  res = res.filter((p) => getUserStatus(p) === 'active');
    return res;
  }, [profiles, wirkerOnly, statusFilter]);

  const setBusyFor = (id: string, v: boolean) => setBusy((prev) => ({ ...prev, [id]: v }));

  // ── Block / Unblock ──────────────────────────────────────────────────
  const handleBlockToggle = useCallback(async (u: HuiProfile) => {
    const status = getUserStatus(u);
    setBusyFor(u.id, true);
    const ok = status === 'blocked'
      ? await unblockUser(u.id, 'basisuser')
      : await blockUser(u.id);
    setBusyFor(u.id, false);
    if (ok) {
      showToast(status === 'blocked' ? `${u.display_name} entsperrt ✅` : `${u.display_name} blockiert 🚫`, 'info');
      refetch();
    } else {
      showToast('Aktion fehlgeschlagen — prüfe die Konsole', 'error');
    }
  }, [refetch]);

  // ── Delete ───────────────────────────────────────────────────────────
  const handleDelete = useCallback((u: HuiProfile) => {
    setConfirmModal({
      open: true,
      title: '⚠️ User löschen',
      message: `Möchtest du „${u.display_name || u.username}" wirklich löschen? (Soft Delete — trust_score wird auf -999 gesetzt)`,
      loading: false,
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, loading: true }));
        const ok = await softDeleteUser(u.id);
        setConfirmModal((p) => ({ ...p, loading: false, open: false }));
        if (ok) {
          showToast(`${u.display_name} gelöscht`, 'info');
          refetch();
          if (selected?.id === u.id) setSelected(null);
        } else {
          showToast('Löschen fehlgeschlagen', 'error');
        }
      },
    });
  }, [refetch, selected]);

  // ── Role ─────────────────────────────────────────────────────────────
  const handleRoleChange = useCallback(async (u: HuiProfile, newRole: string) => {
    setBusyFor(u.id, true);
    const ok = await changeUserRole(u.id, newRole as UserRole);
    setBusyFor(u.id, false);
    if (ok) { showToast(`Rolle → ${newRole} ✅`, 'success'); refetch(); }
    else      showToast('Rollenänderung fehlgeschlagen', 'error');
  }, [refetch]);

  // ── Group / Membership ────────────────────────────────────────────────
  const handleGroupChange = useCallback(async (u: HuiProfile, newGroup: string) => {
    setBusyFor(u.id, true);
    const ok = await changeUserGroup(u.id, newGroup as UserGroup);
    setBusyFor(u.id, false);
    if (ok) { showToast(`Gruppe → ${newGroup} ✅`, 'success'); refetch(); }
    else      showToast('Gruppenänderung fehlgeschlagen', 'error');
  }, [refetch]);

  // ── Toggle Wirker ─────────────────────────────────────────────────────
  const handleToggleWirker = useCallback(async (u: HuiProfile) => {
    setBusyFor(u.id, true);
    const ok = await toggleWirkerStatus(u.id, u.is_wirker);
    setBusyFor(u.id, false);
    if (ok) { showToast('Wirker-Status geändert ✅', 'success'); refetch(); }
    else      showToast('Fehler', 'error');
  }, [refetch]);

  const filterBtn = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  });

  return (
    <DashboardLayout
      title="User-Management"
      headerActions={
        <span style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(81,207,102,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(81,207,102,0.2)' }}>
          ● Live
        </span>
      }
    >
      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }}>🔍</span>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Name oder Username suchen…"
            style={{
              width: '100%', padding: '7px 12px 7px 32px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 8, fontSize: 12,
              color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[
            { key: 'all',        label: 'Alle' },
            { key: 'basis_user', label: 'Basis' },
            { key: 'basisuser',  label: 'Basisuser' },
            { key: 'member',     label: 'Member' },
            { key: 'wirker',     label: 'Wirker' },
            { key: 'admin',      label: 'Admin' },
          ].map((r) => (
            <button key={r.key} style={filterBtn(roleFilter === r.key)} onClick={() => { setRoleFilter(r.key); setPage(0); }}>
              {r.label}
            </button>
          ))}
          <button style={filterBtn(statusFilter === 'blocked')} onClick={() => setStatusFilter(statusFilter === 'blocked' ? 'all' : 'blocked')}>
            🚫 Blockiert
          </button>
          <button style={filterBtn(wirkerOnly)} onClick={() => setWirkerOnly(!wirkerOnly)}>
            ⭐ Wirker
          </button>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {loading ? '…' : `${filtered.length} / ${total}`}
        </span>
        <button onClick={refetch} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ↻
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['User', 'Status', 'Rolle', 'Membership', 'Impact €', 'Aktiv', 'Aktionen'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Keine User gefunden</td></tr>
              ) : filtered.map((u) => {
                const status = getUserStatus(u);
                const isBusy = busy[u.id];
                return (
                  <tr key={u.id} className="tr-hover" style={{ opacity: status === 'deleted' ? 0.4 : 1 }} onClick={() => setSelected(u)}>
                    {/* User */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(u.id), flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0F1117' }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : (u.display_name || u.username || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.display_name || '—'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>@{u.username || '—'}</div>
                        </div>
                      </div>
                    </td>
                    {/* Status */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <StatusBadge status={status} />
                    </td>
                    {/* Role dropdown */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                      <InlineSelect
                        value={u.role || 'basisuser'}
                        disabled={isBusy || status === 'deleted'}
                        options={[
                          { value: 'basis_user',  label: 'Basis User'  },
                          { value: 'basisuser',   label: 'Basisuser'   },
                          { value: 'member',      label: 'Member'      },
                          { value: 'wirker',      label: 'Wirker'      },
                          { value: 'admin',       label: 'Admin'       },
                          { value: 'superadmin',  label: 'Superadmin'  },
                        ]}
                        onChange={(v) => handleRoleChange(u, v)}
                      />
                    </td>
                    {/* Membership */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                      <InlineSelect
                        value={u.membership_type || 'basisuser'}
                        disabled={isBusy || status === 'deleted'}
                        options={[
                          { value: 'basisuser', label: 'Basisuser' },
                          { value: 'member',    label: 'Member'    },
                          { value: 'wirker',    label: 'Wirker'    },
                          { value: 'talent',    label: 'Talent'    },
                          { value: 'impact',    label: 'Impact'    },
                        ]}
                        onChange={(v) => handleGroupChange(u, v)}
                      />
                    </td>
                    {/* Impact */}
                    <td style={{ padding: '10px 14px', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      €{(u.impact_eur || 0).toFixed(0)}
                    </td>
                    {/* Last Seen */}
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      {timeAgo(u.last_seen || u.created_at)}
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ActionBtn title="Details" color="var(--accent)" onClick={() => setSelected(u)}>👁</ActionBtn>
                        <ActionBtn title="Profil bearbeiten" color="var(--gold)" disabled={status === 'deleted'} onClick={() => { setSelected(u); setEditModal(true); }}>✏️</ActionBtn>
                        <ActionBtn
                          title={status === 'blocked' ? 'Entsperren' : 'Blockieren'}
                          color={status === 'blocked' ? 'var(--green)' : 'var(--gold)'}
                          disabled={isBusy || status === 'deleted'}
                          onClick={() => handleBlockToggle(u)}
                        >
                          {isBusy ? '…' : status === 'blocked' ? '🔓' : '🚫'}
                        </ActionBtn>
                        {status !== 'deleted' && (
                          <ActionBtn title="Löschen" color="var(--red)" disabled={isBusy} onClick={() => handleDelete(u)}>🗑</ActionBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Seite {page + 1} / {Math.ceil(total / LIMIT)}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Zurück</Button>
              <Button variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * LIMIT >= total}>Weiter →</Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && !editModal && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={`👤 ${selected.display_name || selected.username}`}
          width={520}
          footer={
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="ghost" onClick={() => setSelected(null)}>Schließen</Button>
              <Button variant="primary" onClick={() => setEditModal(true)}>✏️ Bearbeiten</Button>
              <Button
                variant={getUserStatus(selected) === 'blocked' ? 'primary' : 'danger'}
                onClick={() => { handleBlockToggle(selected); setSelected(null); }}
              >
                {getUserStatus(selected) === 'blocked' ? '🔓 Entsperren' : '🚫 Blockieren'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: avatarColor(selected.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#0F1117', overflow: 'hidden', flexShrink: 0 }}>
              {selected.avatar_url
                ? <img src={selected.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (selected.display_name || selected.username || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.display_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>@{selected.username}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 5 }}>
                <StatusBadge status={getUserStatus(selected)} />
                {selected.is_wirker && <Badge variant="purple">⭐ Wirker</Badge>}
                {selected.is_member && <Badge variant="info">Member</Badge>}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              ['Rolle',       selected.role],
              ['Membership',  selected.membership_type],
              ['Standort',    selected.location_label || selected.location || '—'],
              ['Talent',      selected.talent || '—'],
              ['Impact €',    `€${(selected.impact_eur||0).toFixed(2)}`],
              ['Trust Score', String(selected.trust_score ?? 0)],
              ['Letzter Login', timeAgo(selected.last_seen || '')],
              ['Erstellt',    timeAgo(selected.created_at)],
              ['Verfügbar',   selected.is_available ? 'Ja ✅' : 'Nein'],
              ['Focus',       selected.focus_type || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
          {selected.bio && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              {selected.bio}
            </div>
          )}
          {Array.isArray(selected.skills) && selected.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {selected.skills.map((s) => (
                <span key={s} style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11 }}>{s}</span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Schnell-Aktionen</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => { handleToggleWirker(selected); setSelected(null); }}>
                {selected.is_wirker ? '⭐ Wirker entfernen' : '⭐ Als Wirker'}
              </Button>
              {getUserStatus(selected) !== 'deleted' && (
                <Button variant="danger" onClick={() => { handleDelete(selected); setSelected(null); }}>
                  🗑 Löschen
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        open={editModal}
        onClose={() => setEditModal(false)}
        profile={selected}
        onSaved={() => refetch()}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal((p) => ({ ...p, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        loading={confirmModal.loading}
        confirmLabel="Löschen"
        confirmVariant="danger"
      />
    </DashboardLayout>
  );
}
