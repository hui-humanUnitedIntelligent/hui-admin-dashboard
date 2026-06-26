// frontend/src/app/users/page.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { showToast } from '@/components/ui/Toast';
import UserTable from '@/components/users/UserTable';
import { useUsers, MergedUser, UserFilter } from '@/lib/hooks/useUsers';

// ── Typ-Definitionen ────────────────────────────────────────────────────────
type TabKey = 'active' | 'blocked' | 'deleted' | 'wirker' | 'duplicates';
type RoleFilter = 'all' | 'basisuser' | 'member' | 'wirker' | 'admin';

// ── KPI-Kachel ──────────────────────────────────────────────────────────────
function KPICard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '20px 24px', minWidth: 140,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────
function normalizeName(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}
function findDuplicates(users: MergedUser[]): MergedUser[] {
  const seen = new Map<string, MergedUser[]>();
  for (const u of users) {
    const key = normalizeName(u.display_name || u.username || u.email || '');
    if (key.length < 4) continue;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(u);
  }
  const dupes: MergedUser[] = [];
  seen.forEach(arr => { if (arr.length > 1) dupes.push(...arr); });
  return [...new Map(dupes.map(u => [u.id, u])).values()];
}

async function apiAction(action: string, userId: string, extra: Record<string,unknown> = {}) {
  const res = await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      },
    credentials: 'include',
    body: JSON.stringify({ action, ...extra }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Hauptseite ──────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [activeTab,    setActiveTab]    = useState<TabKey>('active');
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>('all');
  const [search,       setSearch]       = useState('');
  const [confirmUser,  setConfirmUser]  = useState<MergedUser | null>(null);
  const [confirmAction,setConfirmAction]= useState<'block' | 'unblock' | 'delete' | 'restore' | null>(null);
  const [viewUser,     setViewUser]     = useState<MergedUser | null>(null);

  // Alle User laden (ungefiltert für Zähler + Duplikate)
  const { users: allUsers, counts, loading, error, refetch } = useUsers({
    filter: 'all', search, limit: 1000,
  });

  // Tab-Filter anwenden
  const displayUsers = useMemo<MergedUser[]>(() => {
    let base: MergedUser[] = [];
    if (activeTab === 'active')     base = allUsers.filter(u => !u.blocked && !u.is_deleted);
    if (activeTab === 'blocked')    base = allUsers.filter(u => u.blocked && !u.is_deleted);
    if (activeTab === 'deleted')    base = allUsers.filter(u => u.is_deleted);
    if (activeTab === 'wirker')     base = allUsers.filter(u => u.is_wirker);
    if (activeTab === 'duplicates') base = findDuplicates(allUsers);

    // Rollen-Filter
    if (roleFilter !== 'all') {
      if (roleFilter === 'basisuser') base = base.filter(u => ['user',''].includes(u.role?.toLowerCase() || ''));
      if (roleFilter === 'member')    base = base.filter(u => u.role?.toLowerCase() === 'member' || u.is_member);
      if (roleFilter === 'wirker')    base = base.filter(u => u.is_wirker);
      if (roleFilter === 'admin')     base = base.filter(u => ['admin','superadmin'].includes(u.role?.toLowerCase()));
    }
    return base;
  }, [allUsers, activeTab, roleFilter]);

  // Aktion ausführen
  const handleAction = useCallback(async (action: 'block' | 'unblock' | 'delete' | 'restore' | 'view', user: MergedUser) => {
    if (action === 'view') { setViewUser(user); return; }
    setConfirmUser(user);
    setConfirmAction(action);
  }, []);

  const executeAction = useCallback(async () => {
    if (!confirmUser || !confirmAction) return;
    try {
      await apiAction(confirmAction, confirmUser.id);
      showToast(`Aktion "${confirmAction}" erfolgreich`, 'success');
      refetch();
    } catch (err) {
      showToast(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`, 'error');
    } finally {
      setConfirmUser(null);
      setConfirmAction(null);
    }
  }, [confirmUser, confirmAction, refetch]);

  const actionLabels: Record<string, string> = {
    block: 'Blockieren', unblock: 'Entsperren', delete: 'Löschen', restore: 'Wiederherstellen',
  };

  const TABS: { key: TabKey; label: string; count: number; color: string }[] = [
    { key: 'active',     label: 'Aktive User',  count: counts.active,  color: '#68d391' },
    { key: 'blocked',    label: 'Blockiert',     count: counts.blocked, color: '#f6ad55' },
    { key: 'deleted',    label: 'Gelöscht',      count: counts.deleted, color: '#fc8181' },
    { key: 'wirker',     label: 'Wirker',        count: counts.wirker,  color: '#d69e2e' },
    { key: 'duplicates', label: 'Duplikate',     count: findDuplicates(allUsers).length, color: '#f6ad55' },
  ];

  return (
    <DashboardLayout title="User Management">
      <PageHeader
        title="User Management"
        subtitle="Alle registrierten Nutzer verwalten"
      />

      {error && (
        <div style={{ background: '#fc818122', border: '1px solid #fc8181', borderRadius: 8,
          padding: '12px 16px', marginBottom: 16, color: '#fc8181', fontSize: 13 }}>
          Fehler beim Laden: {error}
        </div>
      )}

      {/* KPI-Kacheln */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <KPICard label="Aktive User"  value={counts.active}  color="#68d391" />
        <KPICard label="Blockiert"    value={counts.blocked} color="#f6ad55" />
        <KPICard label="Gelöscht"     value={counts.deleted} color="#fc8181" />
        <KPICard label="Wirker"       value={counts.wirker}  color="#d69e2e" />
      </div>

      {/* Tab-Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === tab.key ? tab.color : 'var(--bg-card)',
            color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${activeTab === tab.key ? tab.color : 'var(--border)'}`,
          }}>
            {activeTab === tab.key && '● '}{tab.label}
            {tab.count > 0 && (
              <span style={{ marginLeft: 6, opacity: 0.8 }}>({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Suche + Rollen-Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`In ${TABS.find(t=>t.key===activeTab)?.label ?? 'Usern'} suchen…`}
          style={{
            flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all','basisuser','member','wirker','admin'] as RoleFilter[]).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} style={{
              padding: '7px 14px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
              background: roleFilter === r ? 'var(--accent)' : 'var(--bg-card)',
              color: roleFilter === r ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: `1px solid ${roleFilter === r ? 'var(--accent)' : 'var(--border)'}`,
            }}>
              {r === 'all' ? 'Alle' : r === 'basisuser' ? 'Basisuser' :
               r === 'member' ? 'Member' : r === 'wirker' ? 'Wirker' : 'Admin'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {displayUsers.length} / {counts.total}
        </span>
      </div>

      {/* Tabelle */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <UserTable users={displayUsers} loading={loading} onAction={handleAction} />
      </div>

      {/* Bestätigungs-Modal */}
      {confirmUser && confirmAction && (
        <ConfirmModal
          open={true}
          title={`${actionLabels[confirmAction]}?`}
          message={`Möchtest du "${confirmUser.display_name || confirmUser.email}" wirklich ${actionLabels[confirmAction].toLowerCase()}?`}
          onConfirm={executeAction}
          onClose={() => { setConfirmUser(null); setConfirmAction(null); }}
          confirmVariant="danger"
        />
      )}

      {/* User-Detail-Modal */}
      {viewUser && (
        <Modal open={true} title="User Details" onClose={() => setViewUser(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            {viewUser.avatar_url && (
              <img src={viewUser.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
            )}
            {[
              ['ID',           viewUser.id],
              ['E-Mail',       viewUser.email ?? '—'],
              ['Name',         viewUser.display_name || viewUser.full_name || '—'],
              ['Username',     viewUser.username ?? '—'],
              ['Rolle',        viewUser.role],
              ['Membership',   viewUser.membership_type ?? '—'],
              ['Wirker',       viewUser.is_wirker ? 'Ja ★' : 'Nein'],
              ['Status',       viewUser.is_deleted ? 'Gelöscht' : viewUser.blocked ? 'Blockiert' : 'Aktiv'],
              ['Impact',       viewUser.impact_eur > 0 ? `€ ${viewUser.impact_eur.toFixed(2)}` : '—'],
              ['Registriert',  new Date(viewUser.created_at).toLocaleDateString('de-DE')],
              ['Letzter Login',viewUser.last_seen_at ? new Date(viewUser.last_seen_at).toLocaleDateString('de-DE') : '—'],
              ['Quelle',       viewUser.source],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span style={{ width: 120, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{val}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
