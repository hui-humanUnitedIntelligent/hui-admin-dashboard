// frontend/src/app/users/page.tsx
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';
import { useProfiles, HuiProfile } from '@/lib/hooks/useSupabase';

// ── Duplicate detection helpers ───────────────────────────────────────────
function normalizeName(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}
function findDuplicates(profiles: HuiProfile[]): Map<string, HuiProfile[]> {
  const groups = new Map<string, HuiProfile[]>();
  // Group by very similar display_name (normalized, min 4 chars)
  const byName = new Map<string, HuiProfile[]>();
  for (const p of profiles) {
    const n = normalizeName(p.display_name || p.username || '');
    if (n.length < 4) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n)!.push(p);
  }
  byName.forEach((arr, k) => { if (arr.length > 1) groups.set('name:' + k, arr); });
  // Group by identical username prefix (first 8 chars)
  const byUser = new Map<string, HuiProfile[]>();
  for (const p of profiles) {
    const u = normalizeName(p.username || '');
    if (u.length < 5) continue;
    const key = u.slice(0, 10);
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key)!.push(p);
  }
  byUser.forEach((arr, k) => {
    if (arr.length > 1 && !Array.from(groups.values()).flat().some(x => arr.some(y => y.id === x.id)))
      groups.set('user:' + k, arr);
  });
  return groups;
}
import { useProfilesRealtime, useProfilesRealtimeOptimistic } from '@/lib/hooks/useUserRealtime';

// ── Types ─────────────────────────────────────────────────────────────────
type UserTab    = 'active' | 'blocked' | 'deleted' | 'wirker' | 'duplicates';
type DrawerSection = 'overview' | 'profil' | 'account' | 'rollen' | 'aktivitaet' | 'wirker' | 'sicherheit' | 'notizen';

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
async function blockUser(id: string)              { return adminAction('block_user', id); }
async function unblockUser(id: string, r: string) { return adminAction('unblock_user', id, { previousRole: r }); }
async function deleteUser(id: string)             { return adminAction('delete_user', id); }

// ── Status helpers ────────────────────────────────────────────────────────
function getUserStatus(u: HuiProfile): 'active' | 'blocked' | 'deleted' {
  if (u.trust_score === -999) return 'deleted';
  if (u.blocked === true || u.role === 'blocked') return 'blocked';
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
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
function TabBar({ tab, setTab, counts }: {
  tab: UserTab; setTab: (t: UserTab) => void;
  counts: { active: number; blocked: number; deleted: number; wirker: number; duplicates: number };
}) {
  const tabs: { key: UserTab; label: string; icon: string; color?: string }[] = [
    { key: 'active',  label: 'Aktive User',  icon: '●' },
    { key: 'blocked', label: 'Blockiert',    icon: '🚫', color: 'var(--gold)' },
    { key: 'deleted', label: 'Gelöscht',     icon: '🗑', color: 'var(--red)'  },
    { key: 'wirker',  label: 'Wirker',       icon: '⭐', color: 'var(--purple)' },
    { key: 'duplicates', label: 'Duplikate',  icon: '⚠️', color: 'var(--gold)' },
  ];
  const cnt: Record<UserTab, number> = counts;
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap' }}>
      {tabs.map(({ key, label, icon, color }) => {
        const active  = tab === key;
        const count   = cnt[key];
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

// ════════════════════════════════════════════════════════════════════════════
// ── PROFILE DRAWER ──────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

const DRAWER_SECTIONS: { key: DrawerSection; label: string; icon: string; sub: string }[] = [
  { key: 'overview',    label: 'Übersicht',       icon: '👤', sub: 'Alle Kerndaten auf einen Blick' },
  { key: 'profil',      label: 'Profil',           icon: '✏️', sub: 'Name, Bio, Talent, Standort' },
  { key: 'account',     label: 'Account',          icon: '🔑', sub: 'E-Mail, Username, Mitgliedschaft' },
  { key: 'rollen',      label: 'Rollen & Rechte',  icon: '🛡️', sub: 'Rolle, Gruppe, Wirker-Status' },
  { key: 'wirker',      label: 'Wirker-Profil',    icon: '⭐', sub: 'Stundensatz, Skills, Verfügbarkeit' },
  { key: 'aktivitaet',  label: 'Aktivität',        icon: '📊', sub: 'Impact, Follower, Views, Dates' },
  { key: 'sicherheit',  label: 'Sicherheit',       icon: '⚠️', sub: 'Status, Trust Score, Aktionen' },
  { key: 'notizen',     label: 'Admin-Notizen',   icon: '📝', sub: 'Interne Notizen zu diesem User' },
];

interface DrawerEditState {
  // Profil
  display_name: string; bio: string; talent: string; tagline: string;
  location: string; website: string;
  // Wirker
  hourly_rate: string; skills: string; is_available: boolean;
  // Rollen
  role: string; membership_type: string; is_wirker: boolean; is_member: boolean; is_guardian: boolean;
  is_talent: boolean; talent_since: string | null;
  // Account
  focus_type: string;
  // Trust
  trust_score: string;
}

function ProfileDrawer({
  user, onClose, onRefetch,
}: { user: HuiProfile; onClose: () => void; onRefetch: () => void }) {
  const [section, setSection]       = useState<DrawerSection>('overview');
  const [menuOpen, setMenuOpen]     = useState(false);
  const [editState, setEditState]   = useState<DrawerEditState>({
    display_name:    user.display_name   || '',
    bio:             user.bio            || '',
    talent:          user.talent         || '',
    tagline:         user.tagline        || '',
    location:        user.location_label || user.location || '',
    website:         ((user as unknown as Record<string, unknown>).website as string) || '',
    hourly_rate:     String((user as unknown as Record<string, unknown>).hourly_rate ?? ''),
    skills:          (Array.isArray(user.skills) ? (user.skills as string[]) : []).join(', '),
    is_available:    user.is_available   ?? true,
    role:            user.role           || 'basisuser',
    membership_type: user.membership_type || 'basisuser',
    is_wirker:       user.is_wirker      ?? false,
    is_member:       user.is_member      ?? false,
    is_guardian:     (user as unknown as Record<string, unknown>).is_guardian as boolean ?? false,
    focus_type:      user.focus_type     || '',
    trust_score:     String(user.trust_score ?? 0),
  });
  const [saving, setSaving]   = useState(false);
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; msg: string; fn: () => Promise<void>; loading: boolean }>({ open: false, title: '', msg: '', fn: async () => {}, loading: false });

  const status = getUserStatus(user);
  const ac = avatarColor(user.id);

  const EF = (key: keyof DrawerEditState) => ({
    value: editState[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setEditState(p => ({ ...p, [key]: e.target.value })),
  });

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', background: 'var(--bg-primary)',
    border: '1px solid var(--border)', borderRadius: 7, fontSize: 12,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 };
  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
  const infoRow = (k: string, v: unknown) => (
    <div key={k} style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{k}</div>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-all' }}>{String(v ?? '—') || '—'}</div>
    </div>
  );

  // Save section
  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {};
    if (section === 'profil') {
      Object.assign(payload, {
        display_name: editState.display_name,
        bio:          editState.bio,
        talent:       editState.talent,
        tagline:      editState.tagline,
        location:     editState.location,
        website:      editState.website,
      });
    } else if (section === 'wirker') {
      Object.assign(payload, {
        hourly_rate:  editState.hourly_rate ? Number(editState.hourly_rate) : null,
        skills:       editState.skills.split(',').map(s => s.trim()).filter(Boolean),
        is_available: editState.is_available,
      });
    } else if (section === 'rollen') {
      // Role
      await adminAction('change_role', user.id, { role: editState.role });
      // Group
      await adminAction('change_group', user.id, { group: editState.membership_type });
      // Toggle wirker
      await adminAction('toggle_wirker', user.id, {
        is_wirker:   editState.is_wirker,
        is_member:   editState.is_member,
        is_guardian: editState.is_guardian,
      });
      setSaving(false);
      showToast('✅ Rollen gespeichert', 'success');
      onRefetch();
      return;
    } else if (section === 'account') {
      Object.assign(payload, { focus_type: editState.focus_type });
    } else if (section === 'sicherheit') {
      Object.assign(payload, { trust_score: Number(editState.trust_score) });
    }
    if (Object.keys(payload).length > 0) {
      const ok = await adminAction('edit_profile', user.id, payload);
      setSaving(false);
      if (ok) { showToast('✅ Gespeichert', 'success'); onRefetch(); }
      else showToast('Fehler beim Speichern', 'error');
    } else {
      setSaving(false);
    }
  };

  // Quick confirm helper
  const ask = (title: string, msg: string, fn: () => Promise<void>) =>
    setConfirm({ open: true, title, msg, fn, loading: false });

  const runBlock = () => ask('🚫 Blockieren', `„${user.display_name || user.username}" blockieren?`, async () => {
    const ok = await blockUser(user.id);
    if (ok) { showToast('Blockiert', 'info'); onRefetch(); onClose(); }
    else showToast('Fehler', 'error');
  });
  const runUnblock = () => ask('🔓 Entsperren', `„${user.display_name || user.username}" entsperren?`, async () => {
    const ok = await unblockUser(user.id, 'basisuser');
    if (ok) { showToast('Entsperrt ✅', 'success'); onRefetch(); onClose(); }
    else showToast('Fehler', 'error');
  });
  const runDelete = () => ask('🗑 Löschen', `„${user.display_name || user.username}" löschen? (Wiederherstellbar)`, async () => {
    const ok = await deleteUser(user.id);
    if (ok) { showToast('Gelöscht', 'info'); onRefetch(); onClose(); }
    else showToast('Fehler', 'error');
  });
  const runRestore = () => ask('♻️ Wiederherstellen', `„${user.display_name || user.username}" wiederherstellen?`, async () => {
    const ok = await adminAction('restore_user', user.id, { role: 'basisuser' });
    if (ok) { showToast('✅ Wiederhergestellt', 'success'); onRefetch(); onClose(); }
    else showToast('Fehler', 'error');
  });

  const editableSections: DrawerSection[] = ['profil', 'account', 'rollen', 'wirker', 'aktivitaet', 'sicherheit'];
  const isEditable = editableSections.includes(section) && section !== 'aktivitaet';

  const currentSect = DRAWER_SECTIONS.find(s => s.key === section)!;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, backdropFilter: 'blur(3px)' }} />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 680,
        background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)',
        zIndex: 1001, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {/* Avatar */}
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: ac, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#0F1117' }}>
            {user.avatar_url
              ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display='none'; }}/>
              : (user.display_name || user.username || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.display_name || user.username}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>@{user.username} · {user.id.slice(0, 8)}…</div>
            <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <StatusBadge status={status} />
              <RoleBadge role={user.role || 'basisuser'} />
              {user.is_wirker && <Badge variant="purple">⭐ Wirker</Badge>}
              {user.is_member && <Badge variant="info">Member</Badge>}
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '6px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
        </div>

        {/* ── Quick-Action Bar ─────────────────────────────────────────── */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {status === 'deleted' && (
            <button onClick={runRestore}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
              ♻️ Wiederherstellen
            </button>
          )}
          {status === 'active' && (
            <button onClick={runBlock}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--gold)', background: 'var(--gold-dim)', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
              🚫 Blockieren
            </button>
          )}
          {status === 'blocked' && (
            <button onClick={runUnblock}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
              🔓 Entsperren
            </button>
          )}
          {status !== 'deleted' && (
            <button onClick={runDelete}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--red)', background: 'var(--red-dim)', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
              🗑 Löschen
            </button>
          )}
        </div>

        {/* ── Navigation — Burger Dropdown ───────────────────────────── */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, position: 'relative' }}>
          {/* Dropdown trigger */}
          <button
            onClick={() => setMenuOpen(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 14px', borderRadius: 9,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-body)',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{currentSect.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{currentSect.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{currentSect.sub}</div>
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 20, right: 20, zIndex: 10,
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
              overflow: 'hidden', marginTop: 2,
            }}>
              {DRAWER_SECTIONS.map((s) => {
                const isActive = s.key === section;
                return (
                  <button key={s.key}
                    onClick={() => { setSection(s.key); setMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '11px 16px', border: 'none', cursor: 'pointer',
                      background: isActive ? 'var(--accent-dim)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                      transition: 'background 0.12s',
                      fontFamily: 'var(--font-body)',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{s.icon}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{s.sub}</div>
                    </div>
                    {isActive && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 14 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ══ OVERVIEW ══ */}
          {section === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>👤 Identität</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {infoRow('Anzeigename',  user.display_name)}
                  {infoRow('Username',     '@' + (user.username || '—'))}
                  {infoRow('Voller Name',  (user as unknown as Record<string,unknown>).full_name)}
                  {infoRow('E-Mail',       user.email)}
                  {infoRow('Telefon',      user.phone)}
                  {infoRow('Talent',       user.talent)}
                  {infoRow('Tagline',      user.tagline)}
                  {infoRow('Standort',     user.location_label || user.location)}
                  {infoRow('Website',      (user as unknown as Record<string,unknown>).website)}
                </div>
                {user.bio && <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{user.bio}</div>}
              </div>

              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>🛡️ Rollen & Status</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {infoRow('Rolle',         user.role)}
                  {infoRow('Membership',    user.membership_type)}
                  {infoRow('Status',        getUserStatus(user))}
                  {infoRow('Trust Score',   user.trust_score ?? 0)}
                  {infoRow('Ist Wirker',    user.is_wirker ? '✅ Ja' : '—')}
                  {infoRow('Ist Member',    user.is_member ? '✅ Ja' : '—')}
                  {infoRow('Ist Guardian',  (user as unknown as Record<string,unknown>).is_guardian ? '✅ Ja' : '—')}
                  {infoRow('Focus Type',    user.focus_type)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>📊 Aktivität</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[
                    ['Impact €', `€${(user.impact_eur||0).toFixed(2)}`],
                    ['Follower', user.follower_count ?? user.followers_count ?? 0],
                    ['Profile Views', (user as unknown as Record<string,unknown>).profile_views ?? 0],
                    ['Erstellt', fmtDate(user.created_at)],
                    ['Letzter Login', fmtDate(user.last_seen || '')],
                    ['Member seit', fmtDate((user as unknown as Record<string,unknown>).member_since as string || '')],
                  ].map(([k, v]) => (
                    <div key={k as string} style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{k as string}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {Array.isArray(user.skills) && (user.skills as string[]).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>🎯 Skills</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {(user.skills as string[]).map(s => (
                      <span key={s} style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11 }}>#{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ PROFIL ══ */}
          {section === 'profil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={row2}>
                <div><label style={labelStyle}>Anzeigename</label><input style={fieldStyle} {...EF('display_name')} /></div>
                <div><label style={labelStyle}>Talent / Beruf</label><input style={fieldStyle} {...EF('talent')} /></div>
                <div><label style={labelStyle}>Tagline</label><input style={fieldStyle} {...EF('tagline')} /></div>
                <div><label style={labelStyle}>Standort</label><input style={fieldStyle} {...EF('location')} /></div>
                <div><label style={labelStyle}>Website</label><input style={fieldStyle} {...EF('website')} placeholder="https://..." /></div>
              </div>
              <div><label style={labelStyle}>Bio</label><textarea style={{ ...fieldStyle, height: 100, resize: 'vertical' }} {...EF('bio')} /></div>
            </div>
          )}

          {/* ══ ACCOUNT ══ */}
          {section === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '10px 14px', background: 'rgba(247,183,49,0.08)', border: '1px solid rgba(247,183,49,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--gold)' }}>
                ⚠️ E-Mail und Username werden direkt über Supabase Auth verwaltet und sind hier nicht änderbar.
              </div>
              <div style={row2}>
                {infoRow('E-Mail (Supabase Auth)', (user as unknown as Record<string,unknown>).email)}
                {infoRow('Username', '@' + (user.username || '—'))}
                {infoRow('Vollständiger Name', (user as unknown as Record<string,unknown>).full_name)}
                {infoRow('User-ID', user.id)}
              </div>
              <div><label style={labelStyle}>Focus Type</label>
                <select style={fieldStyle} value={editState.focus_type} onChange={e => setEditState(p => ({ ...p, focus_type: e.target.value }))}>
                  <option value="">— Kein Focus —</option>
                  <option value="creator">Creator</option>
                  <option value="wirker">Wirker</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="consumer">Consumer</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {infoRow('Membership aktiv', (user as unknown as Record<string,unknown>).membership_active ? '✅ Ja' : 'Nein')}
                {infoRow('Talent-Status', (user as unknown as Record<string,unknown>).is_talent ? '🌟 Aktiv' : '—')}
                {(user as unknown as Record<string,unknown>).talent_since && infoRow('Talent seit', fmtDate((user as unknown as Record<string,unknown>).talent_since as string))}
                {infoRow('Member seit', fmtDate((user as unknown as Record<string,unknown>).member_since as string || ''))}
                {infoRow('Erstellt am', fmtDate(user.created_at))}
                {infoRow('Zuletzt geändert', fmtDate(user.updated_at || ''))}
              </div>
            </div>
          )}

          {/* ══ ROLLEN ══ */}
          {section === 'rollen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={row2}>
                <div>
                  <label style={labelStyle}>Rolle</label>
                  <select style={fieldStyle} value={editState.role} onChange={e => setEditState(p => ({ ...p, role: e.target.value }))}>
                    <option value="basisuser">Basisuser</option>
                    <option value="basis_user">Basis User</option>
                    <option value="member">Member</option>
                    <option value="wirker">Wirker</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Membership Typ</label>
                  <select style={fieldStyle} value={editState.membership_type} onChange={e => setEditState(p => ({ ...p, membership_type: e.target.value }))}>
                    <option value="basisuser">Basisuser</option>
                    <option value="member">Member</option>
                    <option value="wirker">Wirker</option>
                    <option value="talent">Talent</option>
                    <option value="impact">Impact</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Flags</div>
                {[
                  { key: 'is_wirker' as keyof DrawerEditState, label: '⭐ Ist Wirker', desc: 'Kann Dienste anbieten und gebucht werden' },
                  { key: 'is_member' as keyof DrawerEditState, label: '🌟 Ist Member', desc: 'Bezahlte Mitgliedschaft aktiv' },
                  { key: 'is_guardian' as keyof DrawerEditState, label: '🛡️ Ist Guardian', desc: 'Erhöhte Moderationsrechte' },
                ].map(({ key, label, desc }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, cursor: 'pointer' }}>
                    <input type="checkbox"
                      checked={editState[key] as boolean}
                      onChange={e => setEditState(p => ({ ...p, [key]: e.target.checked }))}
                      style={{ width: 15, height: 15, accentColor: 'var(--accent)' }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ══ WIRKER-PROFIL ══ */}
          {section === 'wirker' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!user.is_wirker && (
                <div style={{ padding: '10px 14px', background: 'rgba(247,183,49,0.08)', border: '1px solid rgba(247,183,49,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--gold)' }}>
                  ℹ️ Dieser User ist kein Wirker. Du kannst unter „Rollen & Rechte" den Wirker-Status aktivieren.
                </div>
              )}
              <div style={row2}>
                <div>
                  <label style={labelStyle}>Stundensatz (€)</label>
                  <input style={fieldStyle} type="number" min="0" step="5" {...EF('hourly_rate')} placeholder="z.B. 50" />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', paddingBottom: 4 }}>
                    <input type="checkbox" checked={editState.is_available} onChange={e => setEditState(p => ({ ...p, is_available: e.target.checked }))} style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
                    Verfügbar für Buchungen
                  </label>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Skills (kommagetrennt)</label>
                <input style={fieldStyle} {...EF('skills')} placeholder="skill1, skill2, skill3" />
              </div>
              {Array.isArray(user.skills) && (user.skills as string[]).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(user.skills as string[]).map(s => (
                    <span key={s} style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11 }}>#{s}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {infoRow('Talent-Profil aktiv', user.has_talent_profile ? '✅ Ja' : 'Nein')}
                {infoRow('Talent aktiviert am', fmtDate((user as unknown as Record<string,unknown>).talent_activated_at as string || ''))}
              </div>
            </div>
          )}

          {/* ══ AKTIVITÄT ══ */}
          {section === 'aktivitaet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Impact €', val: `€${(user.impact_eur||0).toFixed(2)}`, color: '#51CF66' },
                  { label: 'Follower', val: user.follower_count ?? user.followers_count ?? 0, color: '#74C0FC' },
                  { label: 'Profile Views', val: (user as unknown as Record<string,unknown>).profile_views ?? 0, color: '#B197FC' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ padding: '14px', background: 'var(--bg-tertiary)', borderRadius: 10, textAlign: 'center', borderTop: `3px solid ${color}` }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{String(val)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>📅 Zeitstempel</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {infoRow('Account erstellt',     fmtDate(user.created_at))}
                  {infoRow('Zuletzt aktiv',         fmtDate(user.last_seen_at || user.last_seen || ''))}
                  {infoRow('Profil aktualisiert',   fmtDate(user.updated_at || ''))}
                  {infoRow('Member seit',           fmtDate((user as unknown as Record<string,unknown>).member_since as string || ''))}
                </div>
              </div>
              {(() => {
                const slots = (user as unknown as Record<string,unknown>).availability_slots;
                if (!slots || Object.keys(slots as object).length === 0) return null;
                return (
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>🗓 Verfügbarkeitsslots</div>
                    <pre style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(slots, null, 2)}
                    </pre>
                  </div>
                );
              })()}
              {(() => {
                const dnaTags = (user as unknown as Record<string,unknown>).dna_tags as string[] | null;
                if (!Array.isArray(dnaTags) || dnaTags.length === 0) return null;
                return (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>🧬 DNA Tags</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {dnaTags.map((t: string) => (
                        <span key={t} style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(177,151,252,0.15)', color: '#B197FC', fontSize: 11 }}>#{t}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══ SICHERHEIT ══ */}
          {section === 'sicherheit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {infoRow('Status',         getUserStatus(user))}
                {infoRow('Trust Score',    user.trust_score ?? 0)}
                {infoRow('User-ID',        user.id)}
                {infoRow('Rolle',          user.role || '—')}
              </div>

              <div>
                <label style={labelStyle}>Trust Score manuell setzen</label>
                <input style={fieldStyle} type="number" {...EF('trust_score')} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>−999 = gelöscht · 0 = normal · positiv = erhöhtes Vertrauen</div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Admin-Aktionen</div>

                {status === 'deleted' && (
                  <button onClick={runRestore} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                    ♻️ User wiederherstellen — als Basisuser zurücksetzen
                  </button>
                )}
                {status === 'active' && (
                  <button onClick={runBlock} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--gold)', background: 'var(--gold-dim)', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                    🚫 User blockieren — Login sperren, Daten bleiben erhalten
                  </button>
                )}
                {status === 'blocked' && (
                  <button onClick={runUnblock} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                    🔓 User entsperren — Login wieder aktivieren
                  </button>
                )}
                {status !== 'deleted' && (
                  <button onClick={runDelete} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--red)', background: 'var(--red-dim)', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                    🗑 User löschen (Soft Delete) — trust_score = −999, wiederherstellbar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Notizen ── */}
        {section === 'notizen' && (
          <div style={{ padding: '0 20px 20px' }}>
            <NotesPanel userId={user.id} />
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>
            Schließen
          </button>
          {isEditable && (
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving ? 'var(--bg-tertiary)' : 'var(--accent)', color: saving ? 'var(--text-muted)' : '#0F1117', cursor: saving ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
              {saving ? '⏳ Speichert…' : '💾 Änderungen speichern'}
            </button>
          )}
        </div>
      </div>

      {/* Confirm modal */}
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
    </>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// ── NOTES PANEL ─────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
interface Note { id: string; text: string; created_at: string; admin_label?: string; }

function NotesPanel({ userId }: { userId: string }) {
  const [notes, setNotes]     = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/notes?userId=${userId}`).then(r => r.json()).catch(() => []);
    setNotes(Array.isArray(res) ? res : []);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [userId]);

  const addNote = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const res = await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', userId, text }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { setNotes(data.notes || []); setText(''); }
    else showToast('Fehler beim Speichern', 'error');
  };

  const deleteNote = async (noteId: string) => {
    const res = await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', userId, noteId }),
    });
    const data = await res.json();
    if (res.ok) setNotes(data.notes || []);
  };

  const saveEdit = async (noteId: string) => {
    const res = await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', userId, noteId, text: editText }),
    });
    const data = await res.json();
    if (res.ok) { setNotes(data.notes || []); setEditing(null); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 11px', background: 'var(--bg-primary)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 12,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div>
      {/* Add note */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
          📝 Neue Notiz
        </label>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Interne Notiz hinzufügen… z.B. 'Hat Support kontaktiert am 31.5.'"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <button
          onClick={addNote} disabled={saving || !text.trim()}
          style={{ marginTop: 8, padding: '7px 18px', borderRadius: 8, border: 'none', background: saving || !text.trim() ? 'var(--bg-tertiary)' : 'var(--accent)', color: saving || !text.trim() ? 'var(--text-muted)' : '#0F1117', cursor: saving || !text.trim() ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)' }}
        >
          {saving ? '…' : '✅ Notiz speichern'}
        </button>
      </div>

      {/* Notes list */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Lade Notizen…</div>
      ) : notes.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📭</div>
          Noch keine Notizen
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map(note => (
            <div key={note.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid var(--gold)' }}>
              {editing === note.id ? (
                <div>
                  <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => saveEdit(note.id)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#0F1117', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-body)' }}>Speichern</button>
                    <button onClick={() => setEditing(null)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-body)' }}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{note.text}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      🔐 {note.admin_label || 'Admin'} · {new Date(note.created_at).toLocaleString('de-DE')}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditing(note.id); setEditText(note.text); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 2 }} onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--accent)')} onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}>✏️</button>
                      <button onClick={() => deleteNote(note.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 2 }} onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--red)')} onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}>🗑</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── MAIN PAGE ───────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
export default function UsersPage() {
  const [tab, setTab]               = useState<UserTab>('active');
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage]             = useState(0);
  const [drawerUser, setDrawerUser] = useState<HuiProfile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction]   = useState('');
  const [bulkData, setBulkData]       = useState<Record<string,string>>({});
  const [bulkBusy, setBulkBusy]       = useState(false);
  const [bulkMsg, setBulkMsg]         = useState('');
  const [showBulkMsg, setShowBulkMsg] = useState(false);
  const [busy, setBusy]             = useState<Record<string, boolean>>({});

  const LIMIT = 50;

  const activeStatus  = tab === 'wirker' ? 'active' : tab === 'active' ? 'active' : tab;
  const isWirkerTab   = tab === 'wirker';

  const { profiles, total, loading, refetch } = useProfiles({
    search, role: roleFilter,
    status: activeStatus as 'active' | 'blocked' | 'deleted',
    is_wirker: isWirkerTab ? true : undefined,
    page, limit: LIMIT, refreshInterval: 15000,
  });

  const { profiles: blockedProfiles } = useProfiles({ status: 'blocked',   limit: 500, refreshInterval: 30000 });
  const { profiles: deletedProfiles } = useProfiles({ status: 'deleted',   limit: 500, refreshInterval: 30000 });
  const { profiles: wirkerProfiles  } = useProfiles({ status: 'active', is_wirker: true, limit: 500, refreshInterval: 60000 });

  // ── All profiles for duplicate detection ─────────────────────────────
  const { profiles: allProfilesForDup } = useProfiles({ status: 'active', limit: 2000, refreshInterval: 60000 });
  const duplicateGroups = findDuplicates(allProfilesForDup);
  const duplicateIds    = new Set(Array.from(duplicateGroups.values()).flat().map(p => p.id));

  const counts = useMemo(() => ({
    active:     total,
    blocked:    blockedProfiles.length,
    deleted:    deletedProfiles.length,
    wirker:     wirkerProfiles.length,
    duplicates: duplicateIds.size,
  }), [total, blockedProfiles.length, deletedProfiles.length, wirkerProfiles.length, duplicateIds.size]);

  // ── Realtime: optimistisch INSERT/UPDATE live in State patchen ──────────
  useProfilesRealtimeOptimistic({
    enabled: true,
    onInsert: (newProfile) => {
      // Neuer User: direkt an die Liste prependen ohne Full-Refetch
      refetch(); // Full-Refetch für korrekte Paginierung
    },
    onUpdate: (updatedProfile) => {
      // Sofortiges State-Patch: kein Warten auf nächsten Fetch-Zyklus
      // (useProfiles state ist read-only, daher refetch triggern)
      refetch();
    },
    onDelete: (_id) => {
      refetch();
    },
  });

  // ── Bulk action handler ──────────────────────────────────────────────
  const handleBulkAction = async () => {
    if (selectedIds.size === 0 || !bulkAction) return;
    if (!confirm(`Aktion "${bulkAction}" auf ${selectedIds.size} User anwenden?`)) return;
    setBulkBusy(true);
    try {
      const body: Record<string,unknown> = { action: bulkAction, userIds: Array.from(selectedIds) };
      if (bulkAction === 'change_role') body.data = { role: bulkData.role };
      if (bulkAction === 'change_membership') body.data = { membership_type: bulkData.membership_type };
      if (bulkAction === 'broadcast') body.data = { title: bulkData.title, body: bulkData.body };
      const res = await fetch('/api/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (res.ok) {
        showToast(`✅ ${d.success || selectedIds.size} User erfolgreich`, 'success');
        setSelectedIds(new Set()); setBulkAction(''); setBulkData({});
        refetch();
      } else showToast(d.error || 'Fehler', 'error');
    } finally { setBulkBusy(false); }
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selectedIds.size === profiles.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(profiles.map(p => p.id)));
  };
  const setBusyFor = (id: string, v: boolean) => setBusy(p => ({ ...p, [id]: v }));

  const handleRoleChange = useCallback(async (u: HuiProfile, role: string) => {
    setBusyFor(u.id, true);
    const ok = await adminAction('change_role', u.id, { role });
    setBusyFor(u.id, false);
    if (ok) { showToast(`Rolle → ${role}`, 'info'); refetch(); }
    else showToast('Fehler', 'error');
  }, [refetch]);

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)', borderRadius: 7, fontSize: 12,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none',
  };

  const banners: Partial<Record<UserTab, { bg: string; border: string; color: string; text: string }>> = {
    blocked: { bg: 'rgba(247,183,49,0.07)', border: 'var(--gold)', color: 'var(--gold)', text: '🚫 Blockierte User sind ausgesperrt. Klicke auf einen User für vollständige Kontrolle.' },
    deleted: { bg: 'rgba(255,107,107,0.06)', border: 'var(--red)', color: 'var(--red)', text: '🗑 Gelöschte User haben trust_score −999. Klicke auf einen User um ihn wiederherzustellen.' },
  };
  const banner = banners[tab];

  function getUserStatusLocal(u: HuiProfile) {
    if (u.trust_score === -999) return 'deleted' as const;
    if (u.role === 'blocked')   return 'blocked' as const;
    return 'active' as const;
  }

  return (
    <DashboardLayout
      title="User Management"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {blockedProfiles.length > 0 && (
            <button onClick={() => setTab('blocked')} style={{ fontSize: 11, background: 'var(--gold-dim)', color: 'var(--gold)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--gold)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              🚫 {blockedProfiles.length} blockiert
            </button>
          )}
          {deletedProfiles.length > 0 && (
            <button onClick={() => setTab('deleted')} style={{ fontSize: 11, background: 'var(--red-dim)', color: 'var(--red)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--red)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
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

      <TabBar tab={tab} setTab={(t) => { setTab(t); setPage(0); }} counts={counts} />

      {banner && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: banner.bg, border: `1px solid ${banner.border}`, borderRadius: 8, fontSize: 12, color: banner.color }}>
          {banner.text}
        </div>
      )}

      {/* ── Bulk Action Bar ── */}
      {selectedIds.size > 0 && (
        <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', animation: 'fadeIn 0.2s ease-out' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
            ✓ {selectedIds.size} User ausgewählt
          </span>
          <select value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkData({}); setShowBulkMsg(false); }}
            style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none' }}>
            <option value="">Aktion wählen…</option>
            <option value="change_role">🎭 Rolle ändern</option>
            <option value="change_membership">🏅 Mitgliedschaft ändern</option>
            <option value="broadcast">📨 Broadcast senden</option>
            <option value="block">🚫 Blockieren</option>
            <option value="unblock">✅ Entsperren</option>
            <option value="delete">🗑 Soft-Delete</option>
          </select>

          {bulkAction === 'change_role' && (
            <select value={bulkData.role || ''} onChange={e => setBulkData(p => ({ ...p, role: e.target.value }))}
              style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none' }}>
              <option value="">Rolle…</option>
              {['basisuser','member','wirker','admin','superadmin'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {bulkAction === 'change_membership' && (
            <select value={bulkData.membership_type || ''} onChange={e => setBulkData(p => ({ ...p, membership_type: e.target.value }))}
              style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none' }}>
              <option value="">Typ…</option>
              {['basisuser','member','wirker','premium'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {bulkAction === 'broadcast' && (
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              {!showBulkMsg ? (
                <button onClick={() => setShowBulkMsg(true)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-body)' }}>✏️ Nachricht verfassen</button>
              ) : (
                <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                  <input value={bulkData.title || ''} onChange={e => setBulkData(p => ({...p, title: e.target.value}))} placeholder="Titel" style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', width: 160 }} />
                  <input value={bulkData.body || ''} onChange={e => setBulkData(p => ({...p, body: e.target.value}))} placeholder="Nachricht" style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 11, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', flex: 1 }} />
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleBulkAction}
            disabled={bulkBusy || !bulkAction}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: bulkBusy || !bulkAction ? 'var(--bg-tertiary)' : (bulkAction === 'delete' || bulkAction === 'block' ? 'var(--red)' : 'var(--accent)'), color: bulkBusy || !bulkAction ? 'var(--text-muted)' : '#0F1117', cursor: bulkBusy || !bulkAction ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', flexShrink: 0 }}
          >
            {bulkBusy ? '⏳' : '✓ Ausführen'}
          </button>
          <button onClick={() => { setSelectedIds(new Set()); setBulkAction(''); setBulkData({}); setShowBulkMsg(false); }} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)', flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* ── Duplicates View ── */}
      {tab === 'duplicates' && (
        <div style={{ marginBottom: 16 }}>
          {duplicateGroups.size === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Keine Duplikate gefunden</div>
            </div>
          ) : Array.from(duplicateGroups.entries()).map(([groupKey, users]) => (
            <div key={groupKey} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--gold)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--gold-dim)', borderBottom: '1px solid var(--gold)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>
                  ⚠️ {groupKey.startsWith('email:') ? '📧 Gleiche E-Mail' : '👤 Ähnlicher Name'} — {users.length} Profile
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {groupKey.replace('email:', '').replace('name:', '')}
                </span>
              </div>
              {users.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} style={{ width: 15, height: 15, accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }} />
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0F1117', flexShrink: 0 }}>
                    {(u.display_name || u.username || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{u.display_name || '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>@{u.username} · {(u as unknown as Record<string,unknown>).email as string || '—'} · {u.role}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Reg: {timeAgo(u.created_at)}</div>
                  <button onClick={() => setDrawerUser(u)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-body)' }}>Profil</button>
                </div>
              ))}
            </div>
          ))}
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

      {/* Table — hide in duplicates tab */}
      {tab !== 'duplicates' && <div style={{ background: 'var(--bg-secondary)', border: `1px solid ${tab === 'deleted' ? 'rgba(255,107,107,0.2)' : tab === 'blocked' ? 'rgba(247,183,49,0.2)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: tab === 'deleted' ? 'rgba(255,107,107,0.03)' : tab === 'blocked' ? 'rgba(247,183,49,0.03)' : undefined }}>
                <th style={{ padding: '10px 10px 10px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)', width: 36 }}>
                    <input type="checkbox" checked={profiles.length > 0 && selectedIds.size === profiles.length} onChange={toggleSelectAll} style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  </th>
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
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {tab === 'deleted' ? '🗑 Keine gelöschten User' :
                     tab === 'blocked' ? '✅ Keine blockierten User' :
                     'Keine User gefunden'}
                  </td>
                </tr>
              ) : profiles.map((u) => {
                const status = getUserStatusLocal(u);
                const isBusy = busy[u.id];
                return (
                  <tr key={u.id} className="tr-hover"
                    style={{ opacity: status === 'deleted' ? 0.55 : 1, cursor: 'pointer', background: selectedIds.has(u.id) ? 'var(--accent-dim)' : (duplicateIds.has(u.id) ? 'rgba(247,183,49,0.04)' : 'transparent') }}
                    onClick={() => setDrawerUser(u)}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '10px 10px 10px 14px', borderBottom: '1px solid var(--border)', width: 36 }} onClick={e => { e.stopPropagation(); toggleSelect(u.id); }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} onClick={e => e.stopPropagation()} style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                        {duplicateIds.has(u.id) && <span title="Mögliches Duplikat" style={{ fontSize: 10, color: 'var(--gold)' }}>⚠️</span>}
                      </div>
                    </td>
                    {/* Avatar + Name */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(u.id), flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0F1117', position: 'relative' }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display='none'; }}/>
                            : (u.display_name || u.username || '?')[0].toUpperCase()}
                          {status === 'deleted' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🗑</div>}
                          {status === 'blocked' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🚫</div>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 500, textDecoration: status === 'deleted' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{u.display_name || '—'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)', marginBottom: 2 }}>@{u.username || '—'}</div>
                          {u.email && <div style={{ color: 'var(--text-muted)', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, marginBottom: 1 }} title={u.email}>✉ {u.email}</div>}
                          {u.phone && <div style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 1 }}>📞 {u.phone}</div>}
                          <div
                            title={u.id}
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(u.id); }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '1px 6px', borderRadius: 5, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', maxWidth: 140 }}
                          >
                            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.id}
                            </span>
                            <span style={{ fontSize: 8, color: 'var(--accent)', flexShrink: 0 }}>📋</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Status */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <StatusBadge status={status} />
                    </td>
                    {/* Role — inline select */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                      {status === 'deleted' || status === 'blocked' ? (
                        <RoleBadge role={u.role || 'basisuser'} />
                      ) : (
                        <select
                          value={u.role || 'basisuser'} disabled={isBusy}
                          onChange={e => handleRoleChange(u, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: isBusy ? 'default' : 'pointer', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', opacity: isBusy ? 0.5 : 1 }}
                        >
                          {[{v:'basisuser',l:'Basisuser'},{v:'basis_user',l:'Basis User'},{v:'member',l:'Member'},{v:'wirker',l:'Wirker'},{v:'admin',l:'Admin'},{v:'superadmin',l:'Superadmin'}].map(o => (
                            <option key={o.v} value={o.v}>{o.l}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    {/* Membership / Info */}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {tab === 'deleted' || tab === 'blocked'
                        ? <span style={{ fontFamily: 'var(--font-mono)' }}>{timeAgo(u.updated_at || u.created_at)}</span>
                        : <Badge variant="neutral">{u.membership_type || 'basisuser'}</Badge>
                      }
                    </td>
                    {/* Impact */}
                    <td style={{ padding: '10px 14px', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      €{(u.impact_eur || 0).toFixed(0)}
                    </td>
                    {/* Last Seen */}
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      {timeAgo(u.last_seen_at || u.last_seen || u.created_at)}
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        {/* Profil-Button */}
                        <button onClick={() => setDrawerUser(u)}
                          title="Profil öffnen"
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                          ☰
                        </button>
                        {/* Blockieren / Entsperren */}
                        {status === 'active' && (
                          <button
                            title="Blockieren"
                            onClick={() => {
                              if (!confirm(`„${u.display_name || u.username}" blockieren?`)) return;
                              adminAction('block_user', u.id).then(ok => {
                                if (ok) { refetch(); }
                              });
                            }}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--gold)', background: 'var(--gold-dim)', color: 'var(--gold)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                            🚫
                          </button>
                        )}
                        {status === 'blocked' && (
                          <button
                            title="Entsperren"
                            onClick={() => {
                              if (!confirm(`„${u.display_name || u.username}" entsperren?`)) return;
                              adminAction('unblock_user', u.id, { previousRole: 'basisuser' }).then(ok => {
                                if (ok) { refetch(); }
                              });
                            }}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                            🔓
                          </button>
                        )}
                        {/* Löschen / Wiederherstellen */}
                        {status !== 'deleted' && (
                          <button
                            title="Löschen (wiederherstellbar)"
                            onClick={() => {
                              if (!confirm(`„${u.display_name || u.username}" löschen?`)) return;
                              adminAction('delete_user', u.id).then(ok => {
                                if (ok) { refetch(); }
                              });
                            }}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--red)', background: 'var(--red-dim)', color: 'var(--red)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                            🗑
                          </button>
                        )}
                        {status === 'deleted' && (
                          <button
                            title="Wiederherstellen"
                            onClick={() => {
                              if (!confirm(`„${u.display_name || u.username}" wiederherstellen?`)) return;
                              adminAction('restore_user', u.id, { role: 'basisuser' }).then(ok => {
                                if (ok) { refetch(); }
                              });
                            }}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                            ♻️
                          </button>
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
      </div>}

      {/* Profile Drawer */}
      {drawerUser && (
        <ProfileDrawer
          user={drawerUser}
          onClose={() => setDrawerUser(null)}
          onRefetch={() => { refetch(); setDrawerUser(null); }}
        />
      )}
    </DashboardLayout>
  );
}
