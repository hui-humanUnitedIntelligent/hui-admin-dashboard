'use client';
import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/Toast';

type AmbLevel = 'bronze' | 'silver' | 'gold' | 'platinum';
type AmbActionPayload = { [key: string]: unknown };

interface AmbDetailData {
  profile: { [key: string]: unknown };
  ambassador: { [key: string]: unknown };
  referrals: { id: string; display_name: string; username: string; avatar_url: string | null; created_at: string }[];
  logs: { id: string; type: string; metadata: { [key: string]: unknown }; created_at: string }[];
}

const LEVEL_CONFIG = {
  bronze:   { color: '#CD7F32', bg: 'rgba(205,127,50,0.12)',   icon: '🥉', label: 'Bronze'   },
  silver:   { color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)',  icon: '🥈', label: 'Silber'   },
  gold:     { color: '#FFD700', bg: 'rgba(255,215,0,0.12)',    icon: '🥇', label: 'Gold'     },
  platinum: { color: '#B197FC', bg: 'rgba(177,151,252,0.12)', icon: '💎', label: 'Platinum'  },
};

const LOG_ICONS_MAP: { [key: string]: string } = {
  ambassador_approved: '✅', ambassador_activated_by_admin: '⚡',
  ambassador_application: '📋', ambassador_rejected: '❌',
  ambassador_revoked: '🚫', ambassador_level_changed: '⬆️',
  ambassador_link_enabled: '🔗', ambassador_link_disabled: '🔒',
};

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('de-DE');
}

function fmtTime(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

interface DrawerProps {
  ambId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function AmbassadorDrawer({ ambId, onClose, onRefresh }: DrawerProps) {
  const [detail, setDetail] = useState<AmbDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'referrals' | 'logs'>('overview');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const url = '/api/ambassador?action=detail&user_id=' + encodeURIComponent(ambId);
    const r = await fetch(url).then(x => x.json()).catch(() => null);
    setDetail(r);
    setLoading(false);
  }, [ambId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const act = async (action: string, payload: AmbActionPayload = {}) => {
    setActing(true);
    try {
      const body = JSON.stringify({ action, user_id: ambId, data: payload });
      const res = await fetch('/api/ambassador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) {
        showToast('Erfolgreich', 'success');
        onRefresh();
        loadDetail();
      } else {
        const e = await res.json();
        showToast(e.error || 'Fehler', 'error');
      }
    } finally {
      setActing(false);
    }
  };

  const ambData = detail ? detail.ambassador : {};
  const levelKey = String((ambData as { level?: string }).level || 'bronze');
  const safeLevel = (levelKey in LEVEL_CONFIG ? levelKey : 'bronze') as AmbLevel;
  const lc = LEVEL_CONFIG[safeLevel];
  const lcBorder = '1px solid ' + lc.color + '44';
  const lcBorderL = '4px solid ' + lc.color;
  const ambRecord = ambData as { is_ambassador?: boolean; status?: string; referral_link?: string; link_active?: boolean; referral_code?: string; activated_at?: string; level?: string };
  const isActive = ambRecord.is_ambassador === true && ambRecord.status === 'active';
  const profile = detail ? (detail.profile as { display_name?: string; username?: string; avatar_url?: string; email?: string; role?: string; trust_score?: number; created_at?: string }) : {};
  const displayName = profile.display_name || profile.username || ambId.slice(0, 8);
  const referrals = detail ? detail.referrals : [];
  const logs = detail ? detail.logs : [];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199, backdropFilter: 'blur(4px)' }}
      />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 520, background: 'var(--bg-primary)', borderLeft: '1px solid var(--border)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>👤 Ambassador-Detail</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Lade…</div>
        ) : !detail ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Nicht gefunden</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* Profil-Header */}
            <div style={{ padding: '20px', borderBottom: lcBorderL, background: lc.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#0F1117', flexShrink: 0, border: lcBorder }}>
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{profile.username || '—'}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: lc.bg, color: lc.color, border: lcBorder }}>{lc.icon} {lc.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: isActive ? 'rgba(81,207,102,0.12)' : 'var(--bg-tertiary)', color: isActive ? 'var(--green)' : 'var(--text-muted)', border: isActive ? '1px solid rgba(81,207,102,0.3)' : '1px solid var(--border)' }}>{isActive ? '✅ Aktiv' : '⏸ Inaktiv'}</span>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { label: 'Referrals', value: String((ambRecord as { referral_count?: number }).referral_count || 0) },
                  { label: 'Umsatz', value: '€' + Number((ambRecord as { revenue_generated?: number }).revenue_generated || 0).toFixed(0) },
                  { label: 'Trust Score', value: String(profile.trust_score || 0) },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: lc.color }}>{stat.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
              {([['overview','Übersicht'],['referrals','Referrals'],['logs','Aktivität']] as [string,string][]).map(([tab,label]) => (
                <button key={tab} onClick={() => setDrawerTab(tab as typeof drawerTab)} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: drawerTab === tab ? 'var(--accent)' : 'var(--text-muted)', borderBottom: drawerTab === tab ? '2px solid var(--accent)' : '2px solid transparent' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab: Übersicht */}
            {drawerTab === 'overview' && (
              <div style={{ padding: 16 }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
                  {[
                    ['E-Mail', profile.email || '—'],
                    ['Rolle', profile.role || '—'],
                    ['Mitglied seit', fmtDate(profile.created_at || '')],
                    ['Aktiviert am', fmtDate(ambRecord.activated_at || '')],
                    ['Referral-Code', ambRecord.referral_code || '—'],
                    ['Link-Status', ambRecord.link_active ? '🔗 Aktiv' : '🔒 Gesperrt'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{k}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Aktionen */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Aktionen</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {!isActive && (
                    <button onClick={() => act('activate')} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(81,207,102,0.4)', background: 'rgba(81,207,102,0.1)', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      ⚡ Aktivieren
                    </button>
                  )}
                  {isActive && (
                    <button onClick={() => act('revoke')} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,100,100,0.4)', background: 'rgba(255,100,100,0.1)', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      🚫 Entziehen
                    </button>
                  )}
                  {isActive && !ambRecord.link_active && (
                    <button onClick={() => act('toggle_link', { active: true })} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      🔗 Link freigeben
                    </button>
                  )}
                  {isActive && ambRecord.link_active && (
                    <button onClick={() => act('toggle_link', { active: false })} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      🔒 Link sperren
                    </button>
                  )}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowLevelMenu(v => !v)} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      ⬆️ Level ändern
                    </button>
                    {showLevelMenu && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, minWidth: 130 }}>
                        {(['bronze','silver','gold','platinum'] as AmbLevel[]).map(lvl => (
                          <button key={lvl} onClick={() => { act('set_level', { level: lvl }); setShowLevelMenu(false); }} style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12, color: LEVEL_CONFIG[lvl].color, fontWeight: safeLevel === lvl ? 700 : 400 }}>
                            {LEVEL_CONFIG[lvl].icon} {LEVEL_CONFIG[lvl].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Referrals */}
            {drawerTab === 'referrals' && (
              <div style={{ padding: 16 }}>
                {referrals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>Noch keine Referrals</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {referrals.map(ref => (
                      <div key={ref.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0F1117' }}>
                          {(ref.display_name || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{ref.display_name || ref.username}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Registriert {fmtDate(ref.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Logs */}
            {drawerTab === 'logs' && (
              <div style={{ padding: 16 }}>
                {logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>Keine Aktivitäten</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {logs.map((log, idx) => (
                      <div key={log.id || idx} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{LOG_ICONS_MAP[log.type] || '📌'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{log.type.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtTime(log.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
