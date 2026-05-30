// frontend/src/app/users/page.tsx
'use client';

import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useProfiles, HuiProfile } from '@/lib/hooks/useSupabase';
import { showToast } from '@/components/ui/Toast';

const AVATAR_COLORS = ['#4ECDC4','#F7B731','#B197FC','#74C0FC','#FF6B6B','#51CF66'];

function avatarColor(id: string) {
  const code = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30)  return `Vor ${days} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE');
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

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [wirkerOnly, setWirkerOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<HuiProfile | null>(null);
  const LIMIT = 50;

  const { profiles, total, loading, refetch, updateProfile } = useProfiles({
    search,
    role: roleFilter,
    page,
    limit: LIMIT,
    refreshInterval: 30000,
  });

  const filtered = useMemo(() => {
    return wirkerOnly ? profiles.filter((p) => p.is_wirker) : profiles;
  }, [profiles, wirkerOnly]);

  const handleToggleWirker = async (profile: HuiProfile) => {
    const ok = await updateProfile(profile.id, { is_wirker: !profile.is_wirker });
    if (ok) showToast(`${profile.display_name}: Wirker-Status geändert`, 'success');
    else    showToast('Fehler beim Aktualisieren', 'error');
    setSelected(null);
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    transition: 'all 0.15s',
  });

  return (
    <DashboardLayout
      title="User-Management"
      headerActions={
        <Button variant="primary" icon="+" onClick={() => showToast('User-Einladung via Supabase auth not yet implemented', 'info')}>
          Einladen
        </Button>
      }
    >
      {/* ── Filter Bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }}>🔍</span>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Name, Username oder Talent suchen…"
            style={{
              width: '100%', padding: '7px 12px 7px 32px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 12, color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'basisuser', 'wirker', 'admin'].map((r) => (
            <button key={r} style={filterBtnStyle(roleFilter === r)} onClick={() => { setRoleFilter(r); setPage(0); }}>
              {r === 'all' ? 'Alle Rollen' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
          <button style={filterBtnStyle(wirkerOnly)} onClick={() => setWirkerOnly(!wirkerOnly)}>
            ⭐ Nur Wirker
          </button>
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {loading ? '…' : `${filtered.length} / ${total}`} User
        </span>

        <button
          onClick={refetch}
          style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['User', 'Username', 'Rolle', 'Wirker', 'Membership', 'Impact €', 'Joined', 'Aktionen'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.8px',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton />
                </>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    Keine User gefunden
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="tr-hover" onClick={() => setSelected(u)}>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(u.id), flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#0F1117' }}>
                          {u.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            (u.display_name || u.username || '?')[0].toUpperCase()
                          )}
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {u.display_name || '—'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      @{u.username || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      {u.role === 'admin'     ? <Badge variant="warning">Admin</Badge>
                      : u.role === 'wirker'   ? <Badge variant="purple">Wirker</Badge>
                      : <Badge variant="neutral">User</Badge>}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      {u.is_wirker ? <Badge variant="accent">⭐ Wirker</Badge> : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <Badge variant={u.membership_type === 'free' ? 'neutral' : 'info'}>
                        {u.membership_type || 'free'}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      €{(u.impact_eur || 0).toFixed(0)}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      {timeAgo(u.created_at)}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          title="Details"
                          onClick={() => setSelected(u)}
                          style={{ padding: '3px 7px', borderRadius: 5, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12 }}
                        >
                          👁
                        </button>
                        <button
                          title={u.is_wirker ? 'Wirker-Status entfernen' : 'Als Wirker markieren'}
                          onClick={() => handleToggleWirker(u)}
                          style={{ padding: '3px 7px', borderRadius: 5, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12 }}
                        >
                          ⭐
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Seite {page + 1} von {Math.ceil(total / LIMIT)}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', opacity: page === 0 ? 0.4 : 1 }}>
                ← Zurück
              </button>
              <button onClick={() => setPage(page + 1)} disabled={(page + 1) * LIMIT >= total}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', cursor: (page + 1) * LIMIT >= total ? 'not-allowed' : 'pointer', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', opacity: (page + 1) * LIMIT >= total ? 0.4 : 1 }}>
                Weiter →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Profil: ${selected?.display_name || selected?.username || '—'}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>Schließen</Button>
            <Button variant="primary" icon="⭐" onClick={() => selected && handleToggleWirker(selected)}>
              {selected?.is_wirker ? 'Wirker-Status entfernen' : 'Als Wirker markieren'}
            </Button>
          </>
        }
      >
        {selected && (
          <div style={{ fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: avatarColor(selected.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: '#0F1117', overflow: 'hidden' }}>
                {selected.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (selected.display_name || '?')[0].toUpperCase()
                )}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selected.display_name || selected.username}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{selected.username}</div>
                {selected.talent && (
                  <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>✨ {selected.talent}</div>
                )}
              </div>
            </div>

            {[
              ['ID',          selected.id.slice(0, 16) + '…'],
              ['Rolle',       selected.role],
              ['Membership',  selected.membership_type],
              ['Wirker',      selected.is_wirker ? 'Ja ✓' : 'Nein'],
              ['Talent',      selected.has_talent_profile ? 'Profil vorhanden' : '—'],
              ['Standort',    selected.location || '—'],
              ['Impact €',    `€${(selected.impact_eur || 0).toFixed(2)}`],
              ['Follower',    String(selected.followers_count || 0)],
              ['Verfügbar',   selected.is_available ? 'Ja' : 'Nein'],
              ['Registriert', new Date(selected.created_at).toLocaleDateString('de-DE')],
            ].map(([key, val]) => (
              <div key={key} style={{ display: 'flex', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>{key}</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: key === 'ID' ? 'var(--font-mono)' : 'inherit', fontSize: key === 'ID' ? 10 : 12 }}>{val}</span>
              </div>
            ))}

            {selected.bio && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {selected.bio}
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
