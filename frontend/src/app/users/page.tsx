// frontend/src/app/users/page.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';
import { useProfiles, useProfilesRealtime, HuiProfile } from '@/lib/hooks/useSupabase';

// ── Types ─────────────────────────────────────────────────────────────────
type UserTab = 'active' | 'blocked' | 'deleted' | 'wirker';

// ── API helpers ───────────────────────────────────────────────────────────
async function adminAction(action: string, userId: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId, data }),
    });
    return res.ok;
  } catch { return false; }
}

async function blockUser(id: string)             { return adminAction('block_user', id); }
async function unblockUser(id: string, r: string){ return adminAction('unblock_user', id, { previousRole: r }); }
async function deleteUser(id: string)            { return adminAction('delete_user', id); }
async function restoreUser(id: string)           { return adminAction('change_role', id, { role: 'basisuser' }); }

// ── Status helpers ────────────────────────────────────────────────────────
function getUserStatus(u: HuiProfile): 'active' | 'blocked' | 'deleted' {
  if (u.trust_score === -999) return 'deleted';
  if (u.role === 'blocked')   return 'blocked';
  return 'active';
}

function timeAgo(iso: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30)  return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}

function avatarColor(id: string) {
  const c = ['#4ECDC4','#F7B731','#B197FC','#74C0FC','#51CF66','#FF6B6B','#FFA94D','#DA77F2'];
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
}

// ── Badge components ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'active' | 'blocked' | 'deleted' }) {
  if (status === 'active')  return <Badge variant="success" dot>Aktiv</Badge>;
  if (status === 'blocked') return <Badge variant="warning" dot>Blockiert</Badge>;
  return <Badge variant="neutral">🗑 Gelöscht</Badge>;
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, 'info' | 'purple' | 'warning' | 'danger' | 'neutral'> = {
    superadmin: 'danger', admin: 'warning', wirker: 'purple', member: 'info',
    basisuser: 'neutral', basis_user: 'neutral', deleted: 'neutral', blocked: 'warning',
  };
  return <Badge variant={map[role] || 'neutral'}>{role}</Badge>;
}

// ── Inline Select ─────────────────────────────────────────────────────────
function InlineSelect({ value, options, onChange, disabled }: {
  value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <select
      value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: disabled ? 'default' : 'pointer',
        background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────
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

// ── Tab Bar ───────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, counts, blockedCount, deletedCount, wirkerCount }: {
  tab: UserTab; setTab: (t: UserTab) => void;
  counts: { active: number; blocked: number; deleted: number; wirker: number };
  blockedCount: number; deletedCount: number; wirkerCount: number;
}) {
  const tabs: { key: UserTab; label: string; icon: string; color?: string }[] = [
    { key: 'active',  label: 'Aktive User',  icon: '●' },
    { key: 'blocked', label: 'Blockiert',    icon: '🚫', color: 'var(--gold)' },
    { key: 'deleted', label: 'Gelöscht',     icon: '🗑', color: 'var(--red)'  },
    { key: 'wirker',  label: 'Wirker',       icon: '⭐', color: 'var(--purple)' },
  ];
  const cnt: Record<UserTab, number> = {
    active: counts.active, blocked: blockedCount, deleted: deletedCount, wirker: wirkerCount,
  };
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap' }}>
      {tabs.map(({ key, label, icon, color }) => {
        const active = tab === key;
        const count  = cnt[key];
        const isDanger = key === 'deleted' || key === 'blocked';
        return (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400,
            border: `1px solid ${active ? (color || 'var(--accent)') : 'var(--border)'}`,
            background: active ? `${(color||'var(--accent)')}1a` : 'var(--bg-secondary)',
            color: active ? (color || 'var(--accent)') : 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10 }}>{icon}</span>
            {label}
            {count > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '0 4px',
                background: active ? (color || 'var(--accent)') : (isDanger && count > 0 ? (color || 'var(--bg-tertiary)') : 'var(--bg-tertiary)'),
                color: active ? '#fff' : (isDanger && count > 0 ? (color || 'var(--text-secondary)') : 'var(--text-secondary)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Edit Form ─────────────────────────────────────────────────────────────
interface EditForm {
  display_name: string; bio: string; location: string; talent: string;
  is_available: boolean; skills: string; tagline: string;
}

// ════════════════════════════════════════════════════════════════════════════
export default function UsersPage() {
  const [tab, setTab]               = useState<UserTab>('active');
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage]             = useState(0);
  const [selected, setSelected]     = useState<HuiProfile | null>(null);
  const [editModal, setEditModal]   = useState(false);
  const [editForm, setEditForm]     = useState<EditForm | null>(null);
  const [saving, setSaving]         = useState(false);
  const [busy, setBusy]             = useState<Record<string, boolean>>({});
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void; loading: boolean;
  }>({ open: false, title: '', message: '', onConfirm: () => {}, loading: false });

  const LIMIT = 50;

  // ── Data fetching — separate per tab ────────────────────────────────
  const activeStatus  = tab === 'wirker'  ? 'active'  : tab === 'active' ? 'active' : tab;
  const isWirkerTab   = tab === 'wirker';

  const { profiles, total, loading, refetch } = useProfiles({
    search, role: roleFilter,
    status: activeStatus as 'active' | 'blocked' | 'deleted',
    is_wirker: isWirkerTab ? true : undefined,
    page, limit: LIMIT, refreshInterval: 15000,
  });

  // Counts for other tabs (separate queries — no pagination)
  const { profiles: blockedProfiles } = useProfiles({ status: 'blocked', limit: 500, refreshInterval: 30000 });
  const { profiles: deletedProfiles } = useProfiles({ status: 'deleted', limit: 500, refreshInterval: 30000 });
  const { profiles: wirkerProfiles  } = useProfiles({ status: 'active', is_wirker: true, limit: 500, refreshInterval: 60000 });

  const counts = useMemo(() => ({
    active:  total,
    blocked: blockedProfiles.length,
    deleted: deletedProfiles.length,
    wirker:  wirkerProfiles.length,
  }), [total, blockedProfiles.length, deletedProfiles.length, wirkerProfiles.length]);

  useProfilesRealtime(refetch, true);

  const setBusyFor = (id: string, v: boolean) => setBusy(p => ({ ...p, [id]: v }));

  // ── Block ────────────────────────────────────────────────────────────
  const handleBlock = useCallback((u: HuiProfile) => {
    setConfirmModal({
      open: true, loading: false,
      title: '🚫 User blockieren',
      message: `„${u.display_name || u.username}" wird blockiert und kann sich nicht mehr einloggen.`,
      onConfirm: async () => {
        setConfirmModal(p => ({ ...p, loading: true }));
        const ok = await blockUser(u.id);
        setConfirmModal(p => ({ ...p, loading: false, open: false }));
        if (ok) { showToast(`${u.display_name} blockiert`, 'info'); refetch(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetch]);

  // ── Unblock ──────────────────────────────────────────────────────────
  const handleUnblock = useCallback((u: HuiProfile) => {
    setConfirmModal({
      open: true, loading: false,
      title: '🔓 User entsperren',
      message: `„${u.display_name || u.username}" wird entsperrt und kann sich wieder einloggen.`,
      onConfirm: async () => {
        setConfirmModal(p => ({ ...p, loading: true }));
        const ok = await unblockUser(u.id, 'basisuser');
        setConfirmModal(p => ({ ...p, loading: false, open: false }));
        if (ok) { showToast(`${u.display_name} entsperrt ✅`, 'success'); refetch(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetch]);

  // ── Delete ───────────────────────────────────────────────────────────
  const handleDelete = useCallback((u: HuiProfile) => {
    setConfirmModal({
      open: true, loading: false,
      title: '🗑 User löschen',
      message: `„${u.display_name || u.username}" wird gelöscht. Du findest ihn danach im Tab "Gelöscht" und kannst ihn wiederherstellen.`,
      onConfirm: async () => {
        setConfirmModal(p => ({ ...p, loading: true }));
        const ok = await deleteUser(u.id);
        setConfirmModal(p => ({ ...p, loading: false, open: false }));
        if (ok) { showToast(`${u.display_name} gelöscht`, 'info'); refetch(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetch]);

  // ── Restore deleted user ─────────────────────────────────────────────
  const handleRestore = useCallback((u: HuiProfile) => {
    setConfirmModal({
      open: true, loading: false,
      title: '♻️ User wiederherstellen',
      message: `„${u.display_name || u.username}" wird als Basisuser wiederhergestellt.`,
      onConfirm: async () => {
        setConfirmModal(p => ({ ...p, loading: true }));
        const ok = await adminAction('restore_user', u.id, { role: 'basisuser' });
        setConfirmModal(p => ({ ...p, loading: false, open: false }));
        if (ok) { showToast('✅ User wiederhergestellt', 'success'); refetch(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetch]);

  // ── Role change ──────────────────────────────────────────────────────
  const handleRoleChange = useCallback(async (u: HuiProfile, role: string) => {
    setBusyFor(u.id, true);
    const ok = await adminAction('change_role', u.id, { role });
    setBusyFor(u.id, false);
    if (ok) { showToast(`Rolle geändert → ${role}`, 'info'); refetch(); }
    else showToast('Fehler', 'error');
  }, [refetch]);

  // ── Group change ─────────────────────────────────────────────────────
  const handleGroupChange = useCallback(async (u: HuiProfile, group: string) => {
    setBusyFor(u.id, true);
    const ok = await adminAction('change_group', u.id, { group });
    setBusyFor(u.id, false);
    if (ok) { showToast(`Gruppe geändert → ${group}`, 'info'); refetch(); }
    else showToast('Fehler', 'error');
  }, [refetch]);

  // ── Save Edit ────────────────────────────────────────────────────────
  const handleSaveEdit = useCallback(async () => {
    if (!selected || !editForm) return;
    setSaving(true);
    const ok = await adminAction('edit_profile', selected.id, {
      ...editForm,
      skills: editForm.skills.split(',').map(s => s.trim()).filter(Boolean),
    });
    setSaving(false);
    if (ok) { showToast('✅ Profil gespeichert', 'success'); refetch(); setEditModal(false); }
    else showToast('Fehler', 'error');
  }, [selected, editForm, refetch]);

  // ── Open edit ────────────────────────────────────────────────────────
  const openEdit = (u: HuiProfile) => {
    setSelected(u);
    setEditForm({
      display_name: u.display_name || '',
      bio: u.bio || '',
      location: u.location_label || u.location || '',
      talent: u.talent || '',
      is_available: u.is_available ?? true,
      skills: (u.skills || []).join(', '),
      tagline: u.tagline || '',
    });
    setEditModal(true);
  };

  // ── Context banner per tab ───────────────────────────────────────────
  const banners: Partial<Record<UserTab, { bg: string; border: string; color: string; text: string }>> = {
    blocked: { bg: 'rgba(247,183,49,0.07)', border: 'var(--gold)', color: 'var(--gold)', text: '🚫 Blockierte User sind ausgesperrt. Du kannst sie entsperren oder endgültig löschen.' },
    deleted: { bg: 'rgba(255,107,107,0.06)', border: 'var(--red)', color: 'var(--red)', text: '🗑 Gelöschte User haben trust_score −999. Klicke auf einen User um ihn als Basisuser wiederherzustellen.' },
  };
  const banner = banners[tab];

  // ── Styles ───────────────────────────────────────────────────────────
  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)', borderRadius: 7, fontSize: 12,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none',
  };

  return (
    <DashboardLayout
      title="User Management"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {blockedProfiles.length > 0 && (
            <button onClick={() => setTab('blocked')}
              style={{ fontSize: 11, background: 'var(--gold-dim)', color: 'var(--gold)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--gold)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              🚫 {blockedProfiles.length} blockiert
            </button>
          )}
          {deletedProfiles.length > 0 && (
            <button onClick={() => setTab('deleted')}
              style={{ fontSize: 11, background: 'var(--red-dim)', color: 'var(--red)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--red)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              🗑 {deletedProfiles.length} gelöscht
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(81,207,102,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(81,207,102,0.2)' }}>● Live</span>
          <button onClick={refetch} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }} className="grid-4">
        {[
          { label: 'Aktive User',  value: loading ? '…' : String(counts.active),  color: 'var(--accent)',  click: () => setTab('active')  },
          { label: 'Blockiert',    value: String(counts.blocked),                  color: 'var(--gold)',   click: () => setTab('blocked') },
          { label: 'Gelöscht',     value: String(counts.deleted),                  color: 'var(--red)',    click: () => setTab('deleted') },
          { label: 'Wirker',       value: String(counts.wirker),                   color: 'var(--purple)', click: () => setTab('wirker')  },
        ].map(({ label, value, color, click }) => (
          <div key={label} onClick={click} style={{ background: 'var(--bg-secondary)', border: `1px solid ${tab === label.toLowerCase().split(' ')[0] ? color : 'var(--border)'}`, borderRadius: 10, padding: '14px 18px', cursor: 'pointer', transition: 'border-color 0.2s' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <TabBar tab={tab} setTab={(t) => { setTab(t); setPage(0); }}
        counts={counts} blockedCount={counts.blocked} deletedCount={counts.deleted} wirkerCount={counts.wirker} />

      {/* Banner */}
      {banner && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: banner.bg, border: `1px solid ${banner.border}`, borderRadius: 8, fontSize: 12, color: banner.color }}>
          {banner.text}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12 }}>🔍</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder={`In ${tab === 'deleted' ? 'gelöschten' : tab === 'blocked' ? 'blockierten' : 'aktiven'} Usern suchen…`}
            style={{ ...fieldStyle, paddingLeft: 30, boxSizing: 'border-box' }} />
        </div>
        {tab === 'active' && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'Alle' },
              { key: 'basisuser', label: 'Basisuser' },
              { key: 'member', label: 'Member' },
              { key: 'wirker', label: 'Wirker' },
              { key: 'admin', label: 'Admin' },
            ].map(r => (
              <button key={r.key} onClick={() => { setRoleFilter(r.key); setPage(0); }} style={{
                padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${roleFilter === r.key ? 'var(--accent)' : 'var(--border)'}`,
                background: roleFilter === r.key ? 'var(--accent-dim)' : 'transparent',
                color: roleFilter === r.key ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
              }}>{r.label}</button>
            ))}
          </div>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {loading ? '…' : `${profiles.length} / ${total}`}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-secondary)', border: `1px solid ${tab === 'deleted' ? 'rgba(255,107,107,0.2)' : tab === 'blocked' ? 'rgba(247,183,49,0.2)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: tab === 'deleted' ? 'rgba(255,107,107,0.03)' : tab === 'blocked' ? 'rgba(247,183,49,0.03)' : undefined }}>
                {['User', 'Status', 'Rolle', tab === 'deleted' || tab === 'blocked' ? 'Gelöscht / Blockiert' : 'Membership', 'Impact €', 'Zuletzt aktiv', 'Aktionen'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton/><Skeleton/><Skeleton/><Skeleton/><Skeleton/></>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {tab === 'deleted' ? '🗑 Keine gelöschten User' :
                     tab === 'blocked' ? '✅ Keine blockierten User' :
                     'Keine User gefunden'}
                  </td>
                </tr>
              ) : profiles.map((u) => {
                const status = getUserStatus(u);
                const isBusy = busy[u.id];
                return (
                  <tr key={u.id} className="tr-hover"
                    style={{ opacity: status === 'deleted' ? 0.55 : 1 }}
                    onClick={() => setSelected(u)}
                  >
                    {/* Avatar + Name */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(u.id), flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0F1117', position: 'relative' }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display='none'; }}/>
                            : (u.display_name || u.username || '?')[0].toUpperCase()
                          }
                          {status === 'deleted' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🗑</div>}
                          {status === 'blocked' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🚫</div>}
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 500, textDecoration: status === 'deleted' ? 'line-through' : 'none' }}>{u.display_name || '—'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>@{u.username || '—'}</div>
                        </div>
                      </div>
                    </td>
                    {/* Status */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <StatusBadge status={status} />
                    </td>
                    {/* Role */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                      {status === 'deleted' || status === 'blocked' ? (
                        <RoleBadge role={u.role || 'basisuser'} />
                      ) : (
                        <InlineSelect
                          value={u.role || 'basisuser'} disabled={isBusy}
                          options={[
                            { value: 'basisuser', label: 'Basisuser' },
                            { value: 'basis_user', label: 'Basis User' },
                            { value: 'member', label: 'Member' },
                            { value: 'wirker', label: 'Wirker' },
                            { value: 'admin', label: 'Admin' },
                            { value: 'superadmin', label: 'Superadmin' },
                          ]}
                          onChange={v => handleRoleChange(u, v)}
                        />
                      )}
                    </td>
                    {/* Membership / Info */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                      {tab === 'deleted' || tab === 'blocked' ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {timeAgo(u.updated_at || u.created_at)}
                        </span>
                      ) : (
                        <InlineSelect
                          value={u.membership_type || 'basisuser'} disabled={isBusy}
                          options={[
                            { value: 'basisuser', label: 'Basisuser' },
                            { value: 'member', label: 'Member' },
                            { value: 'wirker', label: 'Wirker' },
                            { value: 'talent', label: 'Talent' },
                            { value: 'impact', label: 'Impact' },
                          ]}
                          onChange={v => handleGroupChange(u, v)}
                        />
                      )}
                    </td>
                    {/* Impact */}
                    <td style={{ padding: '10px 14px', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      €{(u.impact_eur || 0).toFixed(0)}
                    </td>
                    {/* Last Seen */}
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      {timeAgo(u.last_seen || u.created_at)}
                    </td>
                    {/* Actions — context-aware */}
                    <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button title="Details" onClick={() => setSelected(u)}
                          style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>👁</button>

                        {/* DELETED: only Restore */}
                        {status === 'deleted' && (
                          <button title="Wiederherstellen" disabled={isBusy} onClick={() => handleRestore(u)}
                            style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                            {isBusy ? '…' : '♻️ Restore'}
                          </button>
                        )}

                        {/* BLOCKED: Unblock + Delete */}
                        {status === 'blocked' && (
                          <>
                            <button title="Entsperren" disabled={isBusy} onClick={() => handleUnblock(u)}
                              style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                              {isBusy ? '…' : '🔓 Entsperren'}
                            </button>
                            <button title="Löschen" disabled={isBusy} onClick={() => handleDelete(u)}
                              style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid var(--red)', background: 'var(--red-dim)', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                          </>
                        )}

                        {/* ACTIVE: Edit + Block + Delete */}
                        {status === 'active' && (
                          <>
                            <button title="Bearbeiten" disabled={isBusy} onClick={() => openEdit(u)}
                              style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid var(--gold)', background: 'var(--gold-dim)', color: 'var(--gold)', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                            <button title="Blockieren" disabled={isBusy} onClick={() => handleBlock(u)}
                              style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid var(--gold)', background: 'var(--gold-dim)', color: 'var(--gold)', cursor: 'pointer', fontSize: 12 }}>🚫</button>
                            <button title="Löschen" disabled={isBusy} onClick={() => handleDelete(u)}
                              style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid var(--red)', background: 'var(--red-dim)', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                          </>
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
              <Button variant="ghost" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Zurück</Button>
              <Button variant="ghost" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * LIMIT >= total}>Weiter →</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────────────── */}
      {selected && !editModal && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={`👤 ${selected.display_name || selected.username}`}
          width={540}
          footer={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => setSelected(null)}>Schließen</Button>
              {(() => {
                const st = getUserStatus(selected);
                if (st === 'deleted') return <Button variant="primary" onClick={() => handleRestore(selected)}>♻️ Wiederherstellen</Button>;
                if (st === 'blocked') return (
                  <>
                    <Button variant="primary" onClick={() => handleUnblock(selected)}>🔓 Entsperren</Button>
                    <Button variant="danger"  onClick={() => handleDelete(selected)}>🗑 Löschen</Button>
                  </>
                );
                return (
                  <>
                    <Button variant="primary" onClick={() => openEdit(selected)}>✏️ Bearbeiten</Button>
                    <Button variant="ghost"   onClick={() => handleBlock(selected)}>🚫 Blockieren</Button>
                    <Button variant="danger"  onClick={() => handleDelete(selected)}>🗑 Löschen</Button>
                  </>
                );
              })()}
            </div>
          }
        >
          {/* Status banner */}
          {getUserStatus(selected) === 'deleted' && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
              🗑 Dieser User wurde gelöscht (trust_score = −999). Klicke "Wiederherstellen" um ihn als Basisuser zurückzubringen.
            </div>
          )}
          {getUserStatus(selected) === 'blocked' && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--gold-dim)', border: '1px solid var(--gold)', borderRadius: 8, fontSize: 12, color: 'var(--gold)' }}>
              🚫 Dieser User ist blockiert und kann sich nicht einloggen. Du kannst ihn entsperren oder löschen.
            </div>
          )}
          {/* Avatar + Name */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: avatarColor(selected.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#0F1117', overflow: 'hidden', flexShrink: 0 }}>
              {selected.avatar_url
                ? <img src={selected.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display='none'; }}/>
                : (selected.display_name || selected.username || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.display_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>@{selected.username}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <StatusBadge status={getUserStatus(selected)} />
                {selected.is_wirker && <Badge variant="purple">⭐ Wirker</Badge>}
                {selected.is_member && <Badge variant="info">Member</Badge>}
              </div>
            </div>
          </div>
          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              ['Rolle',         selected.role || '—'],
              ['Membership',    selected.membership_type || '—'],
              ['Standort',      selected.location_label || selected.location || '—'],
              ['Talent',        selected.talent || '—'],
              ['Impact €',      `€${(selected.impact_eur||0).toFixed(2)}`],
              ['Trust Score',   String(selected.trust_score ?? 0)],
              ['Letzter Login', timeAgo(selected.last_seen || '')],
              ['Erstellt',      timeAgo(selected.created_at)],
              ['Verfügbar',     selected.is_available ? 'Ja ✅' : 'Nein'],
              ['Focus',         selected.focus_type || '—'],
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
          {Array.isArray(selected.skills) && (selected.skills as string[]).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(selected.skills as string[]).map((s) => (
                <span key={s} style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11 }}>#{s}</span>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {selected && editModal && editForm && (
        <Modal
          open
          onClose={() => { setEditModal(false); }}
          title={`✏️ Profil bearbeiten: ${selected.display_name || selected.username}`}
          width={520}
          footer={
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="ghost" onClick={() => setEditModal(false)}>Abbrechen</Button>
              <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>{saving ? '…' : '💾 Speichern'}</Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Anzeigename</label>
                <input style={fieldStyle} value={editForm.display_name} onChange={e => setEditForm({ ...editForm, display_name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Talent / Beruf</label>
                <input style={fieldStyle} value={editForm.talent} onChange={e => setEditForm({ ...editForm, talent: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Standort</label>
                <input style={fieldStyle} value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tagline</label>
                <input style={fieldStyle} value={editForm.tagline} onChange={e => setEditForm({ ...editForm, tagline: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Bio</label>
              <textarea style={{ ...fieldStyle, height: 80, resize: 'vertical' }} value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Skills (kommagetrennt)</label>
              <input style={fieldStyle} value={editForm.skills} onChange={e => setEditForm({ ...editForm, skills: e.target.value })} placeholder="skill1, skill2, skill3" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={editForm.is_available} onChange={e => setEditForm({ ...editForm, is_available: e.target.checked })} />
              Verfügbar für Buchungen
            </label>
          </div>
        </Modal>
      )}

      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal(p => ({ ...p, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        loading={confirmModal.loading}
        confirmLabel="Bestätigen"
        confirmVariant="danger"
      />
    </DashboardLayout>
  );
}
