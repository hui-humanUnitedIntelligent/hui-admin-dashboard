// frontend/src/app/talents/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useProfiles, HuiProfile } from '@/lib/hooks/useSupabase';
import { showToast } from '@/components/ui/Toast';

const AVATAR_COLORS = ['#4ECDC4','#F7B731','#B197FC','#74C0FC','#FF6B6B','#51CF66'];
function avatarColor(id: string) {
  const code = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export default function TalentsPage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const [search, setSearch] = useState('');
  const [availOnly, setAvailOnly] = useState(false);
  const [selected, setSelected] = useState<HuiProfile | null>(null);

  const { profiles, total, loading, refetch, updateProfile } = useProfiles({
    search,
    is_wirker: true,
    limit: 100,
    refreshInterval: 0,
  });

  const filtered = availOnly ? profiles.filter((p) => p.is_available) : profiles;

  const handleToggleAvailable = async (p: HuiProfile) => {
    const ok = await updateProfile(p.id, { is_available: !p.is_available });
    if (ok) showToast(`Verfügbarkeit von ${p.display_name} geändert`, 'success');
    setSelected(null);
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  });

  return (
    <DashboardLayout title="Talent-Pool" headerActions={
      <button onClick={refetch} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻ Refresh</button>
    }>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }} className="grid-4">
        {[
          { label: 'Wirker gesamt',   value: loading ? '…' : String(total),                                               color: 'var(--accent)'  },
          { label: 'Verfügbar',       value: loading ? '…' : String(profiles.filter((p) => p.is_available).length),       color: 'var(--green)'   },
          { label: 'Mit Talent-Profil',value: loading ? '…' : String(profiles.filter((p) => p.has_talent_profile).length),color: 'var(--purple)'  },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }}>🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, Talent, Standort…"
            style={{ width: '100%', padding: '7px 12px 7px 32px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')} />
        </div>
        <button style={filterBtnStyle(availOnly)} onClick={() => setAvailOnly(!availOnly)}>✅ Nur Verfügbare</button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} Wirker</span>
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, height: 120, animation: 'pulse 2s ease-in-out infinite' }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Keine Wirker gefunden</div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="card-hover"
              onClick={() => setSelected(p)}
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(p.id), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#0F1117', overflow: 'hidden' }}>
                  {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.display_name || '?')[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.display_name || p.username}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>@{p.username}</div>
                </div>
              </div>
              {p.talent && <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✨ {p.talent}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.location && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>📍 {p.location}</span>}
                <Badge variant={p.is_available ? 'success' : 'neutral'}>{p.is_available ? 'Verfügbar' : 'Nicht verfügbar'}</Badge>
                {p.has_talent_profile && <Badge variant="info">Profil ✓</Badge>}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>
                Impact: €{(p.impact_eur || 0).toFixed(0)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Wirker: ${selected?.display_name}`}
        footer={<>
          <Button variant="ghost" onClick={() => setSelected(null)}>Schließen</Button>
          <Button variant="primary" onClick={() => selected && handleToggleAvailable(selected)}>
            {selected?.is_available ? 'Deaktivieren' : 'Aktivieren'}
          </Button>
        </>}>
        {selected && (
          <div style={{ fontSize: 12 }}>
            {[
              ['Display Name', selected.display_name],
              ['Username',     `@${selected.username}`],
              ['Talent',       selected.talent || '—'],
              ['Standort',     selected.location || '—'],
              ['Verfügbar',    selected.is_available ? 'Ja' : 'Nein'],
              ['Membership',   selected.membership_type],
              ['Follower',     String(selected.followers_count || 0)],
              ['Impact €',     `€${(selected.impact_eur || 0).toFixed(2)}`],
              ['Registriert',  new Date(selected.created_at).toLocaleDateString('de-DE')],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>{k}</span>
                <span style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

