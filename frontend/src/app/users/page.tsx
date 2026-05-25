'use client';

import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Badge, { statusToBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useUsers } from '@/lib/hooks/useUsers';
import { showToast } from '@/components/ui/Toast';
import { DummyUser } from '@/lib/dummy/data';

type FilterType = 'all' | 'active' | 'suspended';

const AVATAR_COLORS = [
  '#4ECDC4','#F7B731','#B197FC','#74C0FC','#FF6B6B','#51CF66',
];

function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function UsersPage() {
  const { users, loading, updateStatus, deleteUser } = useUsers();
  const [filter, setFilter]   = useState<FilterType>('all');
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState<DummyUser | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchF =
        filter === 'all' ||
        (filter === 'active' && u.status === 'active') ||
        (filter === 'suspended' && u.status === 'suspended');
      const q = search.toLowerCase();
      const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      return matchF && matchQ;
    });
  }, [users, filter, search]);

  const handleSuspend = async (user: DummyUser) => {
    const next = user.status === 'active' ? 'suspended' : 'active';
    await updateStatus(user.id, next);
    showToast(`${user.name} wurde ${next === 'suspended' ? 'gesperrt' : 'entsperrt'}`);
    setSelected(null);
  };

  const handleDelete = async (user: DummyUser) => {
    if (!confirm(`User "${user.name}" wirklich löschen?`)) return;
    await deleteUser(user.id);
    showToast(`${user.name} gelöscht`, 'info');
    setSelected(null);
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 0,
    overflow: 'hidden',
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'DM Sans, sans-serif',
    transition: 'all 0.15s',
  });

  return (
    <DashboardLayout
      title="User-Management"
      headerActions={
        <Button variant="primary" icon="+" onClick={() => showToast('Neuer User: Formular öffnet sich im Live-System')}>
          Neuer User
        </Button>
      }
    >
      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }}>
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name oder E-Mail suchen…"
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: 'DM Sans, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'suspended'] as FilterType[]).map((f) => (
            <button key={f} style={filterBtnStyle(filter === f)} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Alle' : f === 'active' ? 'Aktiv' : 'Gesperrt'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} User
        </span>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            Lade…
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Name', 'E-Mail', 'Rolle', 'Status', 'Registriert', 'Aktionen'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} style={{ transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: getAvatarColor(user.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#0F1117', flexShrink: 0 }}>
                          {getInitials(user.name)}
                        </div>
                        <span style={{ color: 'var(--text-primary)' }}>{user.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{user.email}</td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      {user.role === 'Talent' ? <Badge variant="purple">Talent</Badge> : user.role === 'Moderator' ? <Badge variant="info">Moderator</Badge> : <Badge variant="neutral">User</Badge>}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      {statusToBadge(user.status)}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      {new Date(user.createdAt).toLocaleDateString('de-DE')}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ActionBtn title="Details" icon="👁" onClick={() => setSelected(user)} />
                        <ActionBtn title={user.status === 'active' ? 'Sperren' : 'Entsperren'} icon="🚫" onClick={() => handleSuspend(user)} />
                        <ActionBtn title="Löschen" icon="🗑" danger onClick={() => handleDelete(user)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail-Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`User: ${selected?.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>Schließen</Button>
            <Button variant="warning" icon="🚫" onClick={() => selected && handleSuspend(selected)}>
              {selected?.status === 'active' ? 'Sperren' : 'Entsperren'}
            </Button>
          </>
        }
      >
        {selected && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: getAvatarColor(selected.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: '#0F1117' }}>
                {getInitials(selected.name)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.email}</div>
              </div>
            </div>
            {[
              ['ID', `#${String(selected.id).padStart(4, '0')}`],
              ['Rolle', selected.role],
              ['Status', selected.status === 'active' ? 'Aktiv' : 'Gesperrt'],
              ['Stadt', selected.city],
              ['Registriert', new Date(selected.createdAt).toLocaleDateString('de-DE')],
              ['Buchungen', String(selected.bookings)],
              ['Umsatz', `€${selected.revenue.toLocaleString('de-DE')}`],
            ].map(([key, val]) => (
              <div key={key} style={{ display: 'flex', gap: 6, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', width: 90, flexShrink: 0 }}>{key}</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: key === 'ID' ? 'Space Mono, monospace' : undefined }}>{val}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

function ActionBtn({
  title, icon, onClick, danger,
}: {
  title: string; icon: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'var(--red-dim)' : 'var(--bg-card)';
        e.currentTarget.style.color = danger ? 'var(--red)' : 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--text-muted)';
      }}
    >
      {icon}
    </button>
  );
}
