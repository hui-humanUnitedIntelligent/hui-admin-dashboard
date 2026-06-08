'use client';
import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/Toast';

type AmbLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

const LEVEL_CONFIG = {
  bronze:   { color: '#CD7F32', bg: 'rgba(205,127,50,0.12)',   icon: '🥉', label: 'Bronze'   },
  silver:   { color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)',  icon: '🥈', label: 'Silber'   },
  gold:     { color: '#FFD700', bg: 'rgba(255,215,0,0.12)',    icon: '🥇', label: 'Gold'     },
  platinum: { color: '#B197FC', bg: 'rgba(177,151,252,0.12)',  icon: '💎', label: 'Platinum'  },
};

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('de-DE');
}
function fmtDateTime(s: string | null | undefined) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// API-Antwort Typen (entsprechen route.ts action=detail)
interface ApiDetail {
  profile:      Record<string, unknown>;
  refLinks:     Record<string, unknown>[];
  applications: Record<string, unknown>[];
  referrals:    { id: string; display_name: string; username: string | null; avatar_url: string | null; is_active: boolean; joined_at: string }[];
  stats:        { total: number; active: number; sleeping: number };
}

interface DrawerProps {
  ambId:     string;
  onClose:   () => void;
  onRefresh: () => void;
}

export default function AmbassadorDrawer({ ambId, onClose, onRefresh }: DrawerProps) {
  const [detail,        setDetail]        = useState<ApiDetail | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [acting,        setActing]        = useState(false);
  const [tab,           setTab]           = useState<'overview' | 'referrals' | 'logs'>('overview');
  const [showLevelMenu, setShowLevelMenu] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/ambassador?action=detail&user_id=' + encodeURIComponent(ambId));
      const d = await r.json();
      setDetail(d);
    } catch { setDetail(null); }
    setLoading(false);
  }, [ambId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const act = async (action: string, payload: Record<string, unknown> = {}) => {
    setActing(true);
    try {
      const res = await fetch('/api/ambassador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: ambId, data: payload }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { showToast('Erfolgreich', 'success'); onRefresh(); loadDetail(); }
      else        { showToast((d as { error?: string }).error || 'Fehler', 'error'); }
    } finally { setActing(false); }
  };

  // ── Daten aus API-Response extrahieren ────────────────────────
  const profile  = (detail?.profile  || {}) as Record<string, unknown>;
  const refLinks = detail?.refLinks   || [];
  const apps     = detail?.applications || [];
  const referrals = detail?.referrals  || [];
  const stats     = detail?.stats      || { total: 0, active: 0, sleeping: 0 };

  // Ambassador-Daten aus profile_modules
  const pm      = (profile.profile_modules as Record<string, unknown>) || {};
  const ambData = (pm.ambassador as Record<string, unknown>) || {};
  const refLinkRow = refLinks[0] as Record<string, unknown> | undefined;

  const refCount   = Number(ambData.referral_count)    || stats.total || 0;
  const levelKey   = ((): AmbLevel => {
    if (refCount >= 201) return 'platinum';
    if (refCount >= 51)  return 'gold';
    if (refCount >= 11)  return 'silver';
    return 'bronze';
  })();
  const lc       = LEVEL_CONFIG[levelKey];
  const isActive = profile.is_ambassador === true;

  const displayName = String(profile.display_name || profile.username || ambId.slice(0,8));
  const referralLink = String(refLinkRow?.ref_link || ambData.referral_link || '—');
  const referralCode = String(refLinkRow?.referral_code || ambData.referral_code || '—');
  const linkActive   = refLinkRow ? true : (ambData.link_active !== false);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:199, backdropFilter:'blur(4px)' }} />

      {/* Drawer */}
      <div style={{ position:'fixed', right:0, top:0, bottom:0, width:520, background:'var(--bg-primary)', borderLeft:'1px solid var(--border)', zIndex:200, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-secondary)', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>👤 Ambassador-Detail</div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-muted)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:12 }}>Lade…</div>
        ) : !detail || !profile.id ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:24 }}>🔍</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>Daten nicht gefunden</div>
          </div>
        ) : (
          <div style={{ flex:1, overflowY:'auto' }}>

            {/* Profil-Header */}
            <div style={{ padding:20, borderLeft:'4px solid ' + lc.color, background:lc.bg }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                {profile.avatar_url ? (
                  <img src={String(profile.avatar_url)} alt={displayName}
                    style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover', border:'1px solid ' + lc.color + '44' }} />
                ) : (
                  <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#0F1117', flexShrink:0, border:'1px solid ' + lc.color + '44' }}>
                    {displayName.slice(0,2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{displayName}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>@{String(profile.username || '—')}</div>
                  {profile.email && <div style={{ fontSize:11, color:'var(--accent)' }}>{String(profile.email)}</div>}
                </div>
                <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:20, background:lc.bg, color:lc.color, border:'1px solid ' + lc.color + '44' }}>{lc.icon} {lc.label}</span>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:20, background: isActive ? 'rgba(81,207,102,0.12)' : 'var(--bg-tertiary)', color: isActive ? 'var(--green)' : 'var(--text-muted)', border: isActive ? '1px solid rgba(81,207,102,0.3)' : '1px solid var(--border)' }}>{isActive ? '✅ Aktiv' : '⏸ Inaktiv'}</span>
                </div>
              </div>
              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {[
                  { label:'Referrals', value: String(stats.total || refCount) },
                  { label:'Aktive',    value: String(stats.active) },
                  { label:'Schlafend', value: String(stats.sleeping) },
                ].map(s => (
                  <div key={s.label} style={{ background:'var(--bg-primary)', borderRadius:8, padding:'8px 10px', textAlign:'center', border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:16, fontWeight:700, color:lc.color }}>{s.value}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg-secondary)', flexShrink:0 }}>
              {(['overview','Übersicht'],['referrals','Referrals'],['logs','Bewerbungen']] as [string,string][]).map(([t,l]) => (
                <button key={t} onClick={() => setTab(t as typeof tab)} style={{ padding:'10px 16px', border:'none', background:'none', cursor:'pointer', fontSize:12, fontWeight:600, color: tab===t ? 'var(--accent)' : 'var(--text-muted)', borderBottom: tab===t ? '2px solid var(--accent)' : '2px solid transparent' }}>{l}</button>
              ))}
            </div>

            {/* Tab: Übersicht */}
            {tab === 'overview' && (
              <div style={{ padding:16, display:'flex', flexDirection:'column', gap:12 }}>
                {/* Info-Karte */}
                <div style={{ background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
                  {[
                    ['Mitglied seit', fmtDate(profile.created_at as string)],
                    ['Referral-Code', referralCode],
                    ['Link-Status', linkActive ? '🔗 Aktiv' : '🔒 Gesperrt'],
                    ['Ref-Link', referralLink],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display:'flex', padding:'8px 14px', borderBottom:'1px solid var(--border)', alignItems:'flex-start', gap:8 }}>
                      <span style={{ fontSize:11, color:'var(--text-muted)', width:110, flexShrink:0 }}>{k}</span>
                      <span style={{ fontSize:11, color:'var(--text-primary)', wordBreak:'break-all' }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Aktionen */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  <button disabled={acting} onClick={() => act('revoke_ambassador')} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid rgba(255,99,99,0.35)', background:'rgba(255,99,99,0.08)', color:'#ff6363', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    🚫 Revozieren
                  </button>
                  <button disabled={acting} onClick={() => act('toggle_link')} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-secondary)', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    {linkActive ? '🔒 Link sperren' : '🔗 Link freigeben'}
                  </button>
                  {/* Level-Menü */}
                  <div style={{ position:'relative' }}>
                    <button disabled={acting} onClick={() => setShowLevelMenu(v => !v)} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid ' + lc.color + '44', background:lc.bg, color:lc.color, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      ⬆️ Level ▾
                    </button>
                    {showLevelMenu && (
                      <div style={{ position:'absolute', top:'110%', left:0, background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', zIndex:10, minWidth:120 }}>
                        {(Object.keys(LEVEL_CONFIG) as AmbLevel[]).map(lvl => (
                          <button key={lvl} onClick={() => { act('set_level', { level: lvl }); setShowLevelMenu(false); }} style={{ width:'100%', textAlign:'left', padding:'8px 14px', border:'none', background:'none', cursor:'pointer', fontSize:11, color:'var(--text-primary)', fontWeight: lvl===levelKey ? 700 : 400 }}>
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
            {tab === 'referrals' && (
              <div style={{ padding:16 }}>
                {referrals.length === 0 ? (
                  <div style={{ textAlign:'center', padding:32, color:'var(--text-muted)', fontSize:12 }}>Keine Referrals</div>
                ) : referrals.map(r => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#0F1117', flexShrink:0 }}>
                      {(r.display_name || '?').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{r.display_name}</div>
                      {r.username && <div style={{ fontSize:10, color:'var(--text-muted)' }}>@{r.username}</div>}
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>📅 {fmtDate(r.joined_at)}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background: r.is_active ? 'rgba(81,207,102,0.12)' : 'var(--bg-tertiary)', color: r.is_active ? 'var(--green)' : 'var(--text-muted)' }}>
                      {r.is_active ? '⚡ aktiv' : '😴'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Bewerbungen */}
            {tab === 'logs' && (
              <div style={{ padding:16 }}>
                {apps.length === 0 ? (
                  <div style={{ textAlign:'center', padding:32, color:'var(--text-muted)', fontSize:12 }}>Keine Bewerbungen</div>
                ) : apps.map((a, i) => {
                  const app = a as Record<string, unknown>;
                  return (
                    <div key={String(app.id || i)} style={{ background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)', padding:14, marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>Bewerbung vom {fmtDate(app.created_at as string)}</span>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(14,196,184,0.12)', color:'var(--accent)' }}>{String(app.status || '—')}</span>
                      </div>
                      {app.motivation_text && <p style={{ fontSize:11, color:'var(--text-secondary)', margin:0, lineHeight:1.5 }}>{String(app.motivation_text)}</p>}
                      {app.location && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>📍 {String(app.location)}</div>}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}
