// frontend/src/components/views/TalentsView.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';

interface Talent {
  id: string; displayName: string; username: string; avatar_url: string | null;
  tagline: string | null; talent: string | null; skills: string[] | null;
  is_available: boolean; location_label: string | null; trust_score: number;
  impact_eur: number; follower_count: number; has_talent_profile: boolean;
  email: string | null; role: string; created_at: string;
  wirker: { tagline?: string; talent?: string; skills?: string[]; wirker_type?: string; is_featured?: boolean } | null;
}

const AVATAR_COLORS = ['#4ECDC4','#F7B731','#B197FC','#74C0FC','#FF6B6B','#51CF66'];
function avatarColor(id: string) {
  return AVATAR_COLORS[(id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % AVATAR_COLORS.length];
}
function fmtEur(n: number | null | undefined) {
  const v = n ?? 0;
  return v >= 1000 ? `\u20ac${(v/1000).toFixed(1)}K` : `\u20ac${v.toFixed(0)}`;
}

export function TalentsView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [talents,   setTalents]   = useState<Talent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [availOnly, setAvailOnly] = useState(false);
  const [selected,  setSelected]  = useState<Talent | null>(null);
  const [toast,     setToast]     = useState('');
  const [counts,    setCounts]    = useState({ total: 0, available: 0, withProfile: 0 });

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (search)    params.set('search', search);
      if (availOnly) params.set('available', 'true');
      const res = await fetch(`/api/talents?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTalents(Array.isArray(d.talents) ? d.talents : []);
      setCounts({ total: d.total ?? 0, available: d.available ?? 0, withProfile: d.withProfile ?? 0 });
    } catch (e) {
      console.error('[talents]', e);
      setTalents([]);
    } finally {
      setLoading(false);
    }
  }, [search, availOnly]);

  useEffect(() => { load(); }, [load]);

  async function toggleAvailable(t: Talent) {
    try {
      const res = await fetch('/api/talents', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, is_available: !t.is_available }),
      });
      if (res.ok) { showToast('\u2705 Verfügbarkeit geändert'); load(); setSelected(null); }
      else          showToast('Fehler');
    } catch { showToast('Netzwerkfehler'); }
  }

  const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 600 };
  const tdS: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };

  const content = (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'var(--accent)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>
      )}

      <PageHeader
        title="Talent-Pool"
        subtitle="Talente & Wirker-Profile"
        actionsRole={userRole as "superadmin" | "employee"}
        userRole={userRole}
        actions={
          <button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
            ↺ Refresh
          </button>
        }
      />

      {/* KPI-Kacheln */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Wirker Gesamt',    val: counts.total,       icon: '\u2B50', color: 'var(--accent)' },
          { label: 'Verfügbar',        val: counts.available,   icon: '\u2705', color: '#51CF66' },
          { label: 'Mit Talent-Profil',val: counts.withProfile, icon: '\uD83C\uDFAD', color: '#74C0FC' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filter-Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="\uD83D\uDD0D Name, Talent, Standort..."
          style={{ flex: 1, maxWidth: 400, padding: '8px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: availOnly ? 'rgba(81,207,102,0.1)' : 'var(--bg-secondary)' }}>
          <input type="checkbox" checked={availOnly} onChange={e => setAvailOnly(e.target.checked)} style={{ cursor: 'pointer' }} />
          Nur Verfügbare
        </label>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{talents.length} Wirker</span>
      </div>

      {/* Tabelle */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Lade Talent-Pool...</div>
      ) : talents.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Keine Wirker gefunden.</div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                <th style={thS}>Talent</th>
                <th style={thS}>Fähigkeiten</th>
                <th style={thS}>Standort</th>
                <th style={thS}>Impact</th>
                <th style={thS}>Status</th>
                {userRole === 'superadmin' && <th style={thS}>Aktion</th>}
              </tr>
            </thead>
            <tbody>
              {talents.map((t, idx) => (
                <tr key={t.id}
                  onClick={() => setSelected(t)}
                  style={{ borderBottom: idx < talents.length-1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdS}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {t.avatar_url ? (
                        <img src={t.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(t.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                          {(t.displayName?.[0] ?? '?').toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>{t.displayName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.talent || t.wirker?.talent || t.tagline || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdS}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(t.skills ?? t.wirker?.skills ?? []).slice(0, 3).map((s: string) => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{s}</span>
                      ))}
                      {(t.skills ?? []).length > 3 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{(t.skills ?? []).length - 3}</span>}
                    </div>
                  </td>
                  <td style={{ ...tdS, color: 'var(--text-muted)', fontSize: 12 }}>{t.location_label || '—'}</td>
                  <td style={{ ...tdS, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#51CF66' }}>{fmtEur(t.impact_eur)}</td>
                  <td style={tdS}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: t.is_available ? 'rgba(81,207,102,0.15)' : 'rgba(134,142,150,0.15)',
                      color: t.is_available ? '#51CF66' : 'var(--text-muted)',
                    }}>
                      {t.is_available ? '\u2705 Verfügbar' : 'Nicht verfügbar'}
                    </span>
                  </td>
                  {userRole === 'superadmin' && (
                    <td style={tdS} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleAvailable(t)}
                        style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        {t.is_available ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail-Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelected(null)}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 480, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              {selected.avatar_url ? (
                <img src={selected.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: avatarColor(selected.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                  {(selected.displayName?.[0] ?? '?').toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.displayName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.email ?? selected.username}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.talent || selected.tagline || '—'}</div>
              </div>
            </div>
            {[
              ['Standort', selected.location_label ?? '—'],
              ['Trust-Score', String(selected.trust_score ?? 0)],
              ['Impact', fmtEur(selected.impact_eur)],
              ['Follower', String(selected.follower_count ?? 0)],
              ['Registriert', selected.created_at ? new Date(selected.created_at).toLocaleDateString('de-DE') : '—'],
            ].map(([k,v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {(selected.skills ?? []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>SKILLS</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(selected.skills ?? []).map((s: string) => (
                    <span key={s} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {userRole === 'superadmin' && (
                <button onClick={() => toggleAvailable(selected)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: selected.is_available ? '#ff6b6b' : '#51CF66', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {selected.is_available ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              )}
              <button onClick={() => setSelected(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return role === 'employee' ? (
    <EmployeeLayout title="Talent-Pool">{content}</EmployeeLayout>
  ) : (
    <DashboardLayout title="Talent-Pool">{content}</DashboardLayout>
  );
}
