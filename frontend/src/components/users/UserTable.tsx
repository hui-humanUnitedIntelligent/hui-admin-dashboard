// frontend/src/components/users/UserTable.tsx
'use client';

import { useState } from 'react';
import type { MergedUser } from '@/lib/hooks/useUsers';
import { usePaginatedList } from '@/lib/hooks/usePaginatedList';
import PaginationControls from '@/components/ui/PaginationControls';

interface UserTableProps {
  users:    MergedUser[];
  loading:  boolean;
  onAction: (action: 'block' | 'unblock' | 'delete' | 'restore' | 'view' | 'permanent_delete', user: MergedUser) => void;
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; color: string }> = {
    superadmin: { label: 'Super Admin', color: '#e53e3e' },
    admin:      { label: 'Admin',       color: '#dd6b20' },
    wirker:     { label: 'Wirker',      color: '#d69e2e' },
    member:     { label: 'Member',      color: '#3182ce' },
    user:       { label: 'User',        color: '#718096' },
  };
  const cfg = map[role?.toLowerCase()] ?? map['user'];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
      background: cfg.color + '22', color: cfg.color, border: `1px solid ${cfg.color}44`,
    }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ user }: { user: MergedUser }) {
  if (user.is_deleted) return (
    <span style={{ color: '#fc8181', fontSize: 12, fontWeight: 600 }}>● Gelöscht</span>
  );
  if (user.blocked) return (
    <span style={{ color: '#f6ad55', fontSize: 12, fontWeight: 600 }}>● Blockiert</span>
  );
  return <span style={{ color: '#68d391', fontSize: 12, fontWeight: 600 }}>● Aktiv</span>;
}

function Avatar({ user }: { user: MergedUser }) {
  const name   = user.display_name || user.full_name || user.email || '?';
  const letter = name[0]?.toUpperCase() ?? '?';
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={name}
        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)',
    }}>
      {letter}
    </div>
  );
}

export default function UserTable({ users, loading, onAction }: UserTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Pagination: 10 sichtbar, "Mehr laden" bis max. 50, danach echte Seiten-Navigation
  const { pageItems: pagedUsers, canLoadMore, loadMore, page, totalPages, goToPage, total: pagedTotal } =
    usePaginatedList(users, 'created_at');

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => prev.size === users.length ? new Set() : new Set(users.map(u => u.id)));
  };

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 14 }}>Nutzer werden geladen…</div>
    </div>
  );

  if (users.length === 0) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
      Keine Nutzer gefunden
    </div>
  );

  const COL: React.CSSProperties = {
    padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  };
  const TH: React.CSSProperties = {
    ...COL, fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '0.06em', background: 'var(--bg-secondary)',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 40 }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 120 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={TH}>
              <input type="checkbox" checked={selected.size === users.length && users.length > 0}
                onChange={toggleAll} style={{ cursor: 'pointer' }} />
            </th>
            <th style={{ ...TH, textAlign: 'left' }}>USER</th>
            <th style={TH}>STATUS</th>
            <th style={TH}>ROLLE</th>
            <th style={TH}>MEMBERSHIP</th>
            <th style={{ ...TH, textAlign: 'right' }}>IMPACT €</th>
            <th style={TH}>ZULETZT AKTIV</th>
            <th style={TH}>AKTIONEN</th>
          </tr>
        </thead>
        <tbody>
          {pagedUsers.map(user => {
            const name    = user.full_name || user.display_name || user.username || '—';
            const isAdmin = ['admin','superadmin'].includes(user.role?.toLowerCase());
            const rowBg   = selected.has(user.id) ? 'var(--accent)' : user.is_deleted
              ? 'rgba(252,129,129,0.04)' : user.blocked
              ? 'rgba(246,173,85,0.04)' : 'transparent';

            return (
              <tr key={user.id} style={{ background: rowBg, transition: 'background 0.15s' }}>
                <td style={{ ...COL, textAlign: 'center' }}>
                  <input type="checkbox" checked={selected.has(user.id)}
                    onChange={() => toggleSelect(user.id)} style={{ cursor: 'pointer' }} />
                </td>
                <td style={{ ...COL, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Avatar user={user} />
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13,
                        color: isAdmin ? '#fc8181' : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {name}
                        {user.is_wirker && (
                          <span title="Wirker" style={{ color: '#d69e2e', fontSize: 11 }}>★</span>
                        )}
                        {user.source === 'auth_only' && (
                          <span title="Nur in Auth — kein Profil" style={{ color: '#718096', fontSize: 10 }}>⚡</span>
                        )}
                        {user.blocked && user.blocked_reason && (
                          <span
                            title={`Blockiergrund: ${user.blocked_reason}`}
                            onClick={e => { e.stopPropagation(); alert(`Blockiergrund:\n${user.blocked_reason}`); }}
                            style={{ cursor:'pointer', fontSize:12, color:'#f6ad55', padding:'0 2px' }}>
                            ⚠️
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 11, color: 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {user.username ? `@${user.username}` : (user.email ?? '—')}
                      </div>
                      {user.username && user.email && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user.email}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ ...COL, textAlign: 'center' }}>
                  <StatusBadge user={user} />
                </td>
                <td style={{ ...COL, textAlign: 'center' }}>
                  <RoleBadge role={user.role} />
                </td>
                <td style={{ ...COL, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {user.membership_type ?? '—'}
                </td>
                <td style={{ ...COL, textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                  {user.impact_eur > 0 ? `€ ${user.impact_eur.toFixed(2)}` : '—'}
                </td>
                <td style={{ ...COL, textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {user.last_seen_at
                    ? new Date(user.last_seen_at).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit' })
                    : '—'}
                </td>
                <td style={{ ...COL, textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button onClick={() => onAction('view', user)} title="Details"
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4,
                        color: 'var(--text-secondary)', padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>
                      ◉
                    </button>
                    {!user.is_deleted && !user.blocked && (
                      <button onClick={() => onAction('block', user)} title="Blockieren"
                        style={{ background: 'none', border: '1px solid #f6ad55', borderRadius: 4,
                          color: '#f6ad55', padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>
                        ⊘
                      </button>
                    )}
                    {user.blocked && !user.is_deleted && (
                      <button onClick={() => onAction('unblock', user)} title="Entsperren"
                        style={{ background: 'none', border: '1px solid #68d391', borderRadius: 4,
                          color: '#68d391', padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>
                        ✓
                      </button>
                    )}
                    {!user.is_deleted && (
                      <button onClick={() => onAction('delete', user)} title="Löschen"
                        style={{ background: 'none', border: '1px solid #fc8181', borderRadius: 4,
                          color: '#fc8181', padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>
                        ✕
                      </button>
                    )}
                    {user.is_deleted && (
                      <>
                        <button onClick={() => onAction('restore', user)} title="Wiederherstellen"
                          style={{ background: 'none', border: '1px solid #3182ce', borderRadius: 4,
                            color: '#3182ce', padding: '3px 8px', cursor: 'pointer', fontSize: 11, marginRight: 4 }}>
                          ↺
                        </button>
                        <button onClick={() => onAction('permanent_delete', user)} title="Endgültig löschen"
                          style={{ background: 'rgba(252,129,129,0.10)', border: '1px solid #fc8181', borderRadius: 4,
                            color: '#fc8181', padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <PaginationControls
        visibleCount={pagedUsers.length} pageSize={Math.min(50, users.length - (page-1)*50)}
        total={pagedTotal} canLoadMore={canLoadMore} onLoadMore={loadMore}
        page={page} totalPages={totalPages} onGoToPage={goToPage}
      />
    </div>
  );
}
