'use client';
type AmbActionData = Record<string, unknown>;
// frontend/src/app/ambassadors/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSessionToken } from '@/lib/session';
import { AMBASSADOR_LEVELS } from '@/lib/ambassador-levels';
import type { AmbLevel } from '@/lib/ambassador-levels';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────
type MainTab    = 'active' | 'applications' | 'search' | 'logs';

interface AmbRecord {
  id: string; display_name: string; username: string; avatar_url: string | null;
  role: string; is_talent: boolean; trust_score: number; created_at: string;
  referral_code: string; referral_link: string; level: AmbLevel; status: string;
  activated_at: string; link_active: boolean;
  referral_count: number; revenue_generated: number; rewards: {type:string;name:string;granted_at:string}[];
}
interface Application {
  id: string; user_id?: string; display_name: string; username: string; avatar_url: string|null;
  role: string; is_talent: boolean; follower_count: number; trust_score: number;
  created_at: string; applied_at?: string; motivation?: string|null;
  first_name?: string|null; last_name?: string|null; age?: number|null;
  gender?: string|null; location?: string|null; motivation_text?: string|null;
  media_urls?: {url:string;type:string;name:string}[];
  source?: string;
}
interface SearchResult {
  id: string; display_name: string; username: string; avatar_url: string|null;
  email: string|null; role: string; is_talent: boolean; trust_score: number;
  created_at: string; ambassador_status: string|null; is_ambassador: boolean;
}
interface AmbDetail {
  profile: Record<string,unknown>; ambassador: Record<string,unknown>;
  referrals: {id:string;display_name:string;username:string;avatar_url:string|null;joined_at:string}[];
  logs: {id:string;type:string;metadata:Record<string,unknown>;created_at:string}[];
}
interface AmbStats {
  active_ambassadors: number; pending_applications: number;
  total_referrals: number; total_revenue: number; net_impact: number;
  level_distribution: Record<string,number>;
}

// ── Design ────────────────────────────────────────────────────
// LEVEL aus lib/ambassador-levels.ts
const LEVEL = Object.fromEntries(
  AMBASSADOR_LEVELS.map(l => [l.level, { color: l.color, bg: l.bg, icon: l.icon, label: l.label }])
) as Record<AmbLevel, { color: string; bg: string; icon: string; label: string }>;
const STATUS_COLORS: Record<string,{color:string;label:string}> = {
  active:   { color:'var(--green)',  label:'Aktiv'        },
  pending:  { color:'var(--gold)',   label:'Antrag offen' },
  rejected: { color:'var(--red)',    label:'Abgelehnt'    },
  revoked:  { color:'var(--red)',    label:'Entzogen'     },
};
const LOG_ICONS: Record<string,string> = {
  ambassador_approved:            '✅', ambassador_activated_by_admin: '⚡',
  ambassador_application:         '📋', ambassador_rejected:           '❌',
  ambassador_revoked:             '🚫', ambassador_level_changed:     '⬆️',
  ambassador_link_enabled:        '🔗', ambassador_link_disabled:     '🔒',
};

function fmtEur(n: number) { return n >= 1000 ? `€${(n/1000).toFixed(1)}K` : `€${n.toFixed(2)}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('de-DE', {day:'2-digit',month:'short',year:'numeric'}); }
function fmtTime(iso: string) { return new Date(iso).toLocaleString('de-DE', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }

interface AvatarProps {src?:string|null;name:string;size?:number;}
function Avatar({src,name,size=32}:AvatarProps) {
  const initials = (name||'?').slice(0,2).toUpperCase();
  if (src) return <img src={src} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />;
  return <div style={{width:size,height:size,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.35,fontWeight:700,color:'#0F1117',flexShrink:0}}>{initials}</div>;
}
function LevelBadge({level}:Readonly<{level:AmbLevel}>) {
  const c = LEVEL[level]||LEVEL.bronze;
  return <span style={{fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:20,background:c.bg,color:c.color,border:('1px solid ' + c.color + '55'),display:'inline-flex',alignItems:'center',gap:4}}>{c.icon} {c.label}</span>;
}
const DEFAULT_STATUS = {color:'var(--text-muted)',label:'unbekannt'};
function StatusBadge({status}:Readonly<{status:string}>) {
  const sc = STATUS_COLORS[status];
  const c  = sc ? sc : {...DEFAULT_STATUS, label: status};
  return <span style={{fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:20,background:(c.color + '18'),color:c.color,border:('1px solid ' + c.color + '44')}}>{c.label}</span>;
}

// ── Referral Link Cell ─────────────────────────────────────────
interface RLCProps {link:string;active:boolean;onCopy:()=>void;}
function ReferralLinkCell({link,active,onCopy}:RLCProps) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
      <span style={{fontSize:10,fontFamily:'var(--font-mono)',color:active?'var(--accent)':'var(--text-muted)',background:'var(--bg-tertiary)',padding:'2px 8px',borderRadius:6,border:'1px solid var(--border)',textDecoration:active?'none':'line-through',whiteSpace:'nowrap',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis'}} title={link}>
        {link}
      </span>
      {active && (
        <button onClick={onCopy} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,padding:2,color:'var(--text-muted)'}} title="Kopieren">📋</button>
      )}
      <span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:10,background:active?'rgba(81,207,102,0.12)':'var(--bg-tertiary)',color:active?'var(--green)':'var(--text-muted)',border:(active ? '1px solid rgba(81,207,102,0.3)' : '1px solid var(--border)')}}>
        {active?'🔗 Aktiv':'🔒 Gesperrt'}
      </span>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────
import AmbassadorDrawer from './AmbassadorDrawer';

// ── Main Page ─────────────────────────────────────────────────
export default function AmbassadorsPage() {
  const [ambassadors, setAmbassadors]   = useState<AmbRecord[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats]               = useState<AmbStats|null>(null);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<MainTab>('active');
  const [selectedId, setSelectedId]     = useState<string|null>(null);
  const [search, setSearch]             = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [logs, setLogs]                 = useState<{id:string;type:string;metadata:Record<string,unknown>;created_at:string}[]>([]);
  const [acting, setActing]             = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const chartRef  = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<unknown>(null);

  const input: React.CSSProperties = {width:'100%',padding:'8px 11px',background:'var(--bg-primary)',border:'1px solid var(--border)',borderRadius:8,fontSize:12,color:'var(--text-primary)',fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'};

  const load = useCallback(async () => {
    setLoading(true);
    const [list, apps, s, l] = await Promise.all([
      fetch('/api/ambassador?action=list', { headers: { Authorization: 'Bearer ' + (getSessionToken() || '') } }).then(r=>r.json()).catch(()=>[]),
      fetch('/api/ambassador?action=applications', { headers: { Authorization: 'Bearer ' + (getSessionToken() || '') } }).then(r=>r.json()).catch(()=>[]),
      fetch('/api/ambassador?action=stats', { headers: { Authorization: 'Bearer ' + (getSessionToken() || '') } }).then(r=>r.json()).catch(()=>null),
      fetch('/api/ambassador?action=logs', { headers: { Authorization: 'Bearer ' + (getSessionToken() || '') } }).then(r=>r.json()).catch(()=>[]),
    ]);
    setAmbassadors(Array.isArray(list)?list:[]);
    setApplications(Array.isArray(apps)?apps:[]);
    setStats(s); setLogs(Array.isArray(l)?l:[]); setLoading(false);
  }, []);
  useEffect(()=>{load();},[load]);

  // Chart
  useEffect(()=>{
    if(!chartRef.current||!stats) return;
    (async()=>{
      const {Chart,registerables} = await import('chart.js');
      Chart.register(...registerables);
      if(chartInst.current)(chartInst.current as {destroy:()=>void}).destroy();
      const ld = stats.level_distribution;
      chartInst.current = new Chart(chartRef.current!,{
        type:'doughnut',
        data:{
          labels:['Bronze','Silber','Gold','Platin'],
          datasets:[{data:[ld.bronze||0,ld.silver||0,ld.gold||0,ld.platinum||0],backgroundColor:['rgba(205,127,50,0.8)','rgba(192,192,192,0.8)','rgba(255,215,0,0.8)','rgba(177,151,252,0.8)'],borderColor:['#CD7F32','#C0C0C0','#FFD700','#B197FC'],borderWidth:2}],
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'right',labels:{color:'var(--text-secondary)',font:{size:11}}}}},
      });
    })();
    return ()=>{ if(chartInst.current)(chartInst.current as {destroy:()=>void}).destroy(); };
  },[stats]);

  // Search
  const doSearch = useCallback((q:string)=>{
    if(searchRef.current) clearTimeout(searchRef.current);
    if(q.length<2){setSearchResults([]);return;}
    searchRef.current = setTimeout(async()=>{
      setSearchLoading(true);
      const r = await fetch('/api/ambassador?action=search&q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + (getSessionToken() || '') } }).then(x=>x.json()).catch(()=>[]);
      setSearchResults(Array.isArray(r)?r:[]);
      setSearchLoading(false);
    },350);
  },[]);

  const manualActivate = async(userId:string)=>{
    setActing(true);
    try {
      const res = await fetch('/api/ambassador',{method:'POST',headers:{'Content-Type':'application/json', Authorization:'Bearer '+(getSessionToken()||'')},body:JSON.stringify({action:'activate',user_id:userId})});
      const d = await res.json();
      if(res.ok){showToast(`✅ Ambassador aktiviert — ${d.referral_link}`,'success');load();doSearch(search);}
      else showToast(d.error||'Fehler','error');
    } finally{setActing(false);}
  };

  const kpiTiles = [
    {label:'Aktive Ambassadors',   value:stats?.active_ambassadors??'…',    icon:'🤝', color:'var(--accent)'},
    {label:'Offene Anträge',       value:stats?.pending_applications??'…',  icon:'📋', color:'var(--gold)'},
    {label:'Referrals gesamt',     value:stats?.total_referrals??'…',        icon:'👥', color:'var(--green)'},
    {label:'Umsatz durch Amb.',    value:stats?fmtEur(stats.total_revenue):'…',icon:'💰',color:'#4ECDC4'},
    {label:'Impact (Netto)',       value:stats?fmtEur(stats.net_impact):'…', icon:'🌱', color:'#B197FC'},
  ];

  const tabs: {key:MainTab;label:string;count?:number}[] = [
    {key:'active',       label:`✅ Aktive (${ambassadors.length})`},
    {key:'applications', label:`📋 Anträge (${applications.length})`, count:applications.length},
    {key:'search',       label:'🔍 Nutzer suchen'},
    {key:'logs',         label:`📋 Aktivitätslog (${logs.length})`},
  ];

  return (
    <DashboardLayout
      title="Ambassador-Programm"
      headerActions={
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {(stats?.pending_applications||0)>0 && (
            <span style={{fontSize:11,color:'var(--gold)',background:'rgba(255,184,0,0.12)',padding:'3px 10px',borderRadius:20,border:'1px solid rgba(255,184,0,0.4)',fontWeight:600}}>
              ⚠️ {stats!.pending_applications} Antrag{stats!.pending_applications>1?'e':''} offen
            </span>
          )}
          <span style={{fontSize:11,color:'var(--accent)',background:'var(--accent-dim)',padding:'3px 10px',borderRadius:20,border:'1px solid var(--accent)',fontWeight:600}}>
            🤝 {stats?.active_ambassadors??'…'} aktiv
          </span>
          <button onClick={load} style={{padding:'5px 10px',background:'var(--bg-tertiary)',border:'1px solid var(--border)',borderRadius:8,fontSize:11,color:'var(--text-secondary)',cursor:'pointer',fontFamily:'var(--font-body)'}}>↻</button>
        </div>
      }
    >
      {/* Info Banner */}
      <div style={{padding:'10px 16px',background:'rgba(78,205,196,0.06)',border:'1px solid rgba(78,205,196,0.2)',borderRadius:10,fontSize:11,color:'var(--text-secondary)',marginBottom:16,lineHeight:1.7}}>
        <strong style={{color:'var(--accent)'}}>🤝 Manuelles Ambassador-System</strong> — Nutzer werden <strong>ausschließlich durch Admin-Aktivierung oder nach geprüftem Antrag</strong> zu Ambassadors. Referral-Links werden erst nach Aktivierung generiert.
      </div>

      {/* KPI Tiles */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:16}}>
        {kpiTiles.map(k=>(
          <div key={k.label} style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',borderTop:('3px solid ' + k.color)}}>
            <div style={{fontSize:20,fontWeight:700,color:k.color,fontFamily:'var(--font-mono)'}}>{loading?'…':k.value}</div>
            <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginTop:4}}>{k.icon} {k.label}</div>
          </div>
        ))}
      </div>

      {/* Level Distribution Chart */}
      {stats && (
        <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:12,padding:16,marginBottom:16,display:'grid',gridTemplateColumns:'1fr 200px',gap:16,alignItems:'center'}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text-primary)',marginBottom:12}}>📊 Level-Verteilung</div>
            <div style={{display:'flex',gap:10}}>
              {(['bronze','silver','gold','platinum'] as AmbLevel[]).map(lvl=>{
                const c=LEVEL[lvl]; const n=stats.level_distribution[lvl]||0;
                const total=Math.max(stats.active_ambassadors,1); const pct=Math.round(n/total*100);
                return (
                  <div key={lvl} style={{flex:1,textAlign:'center'}}>
                    <div style={{fontSize:12,fontWeight:700,color:c.color,marginBottom:5}}>{c.icon} {n}</div>
                    <div style={{height:6,background:'var(--bg-tertiary)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:(pct + '%'),background:c.color,borderRadius:3,transition:'width 0.5s ease'}} />
                    </div>
                    <div style={{fontSize:9,color:'var(--text-muted)',marginTop:3}}>{c.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{height:140}}>
            <canvas ref={chartRef} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{padding:'5px 14px',borderRadius:8,border:'1px solid',borderColor:activeTab===t.key?'var(--accent)':'var(--border)',background:activeTab===t.key?'var(--accent-dim)':'transparent',color:activeTab===t.key?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'var(--font-body)',whiteSpace:'nowrap',position:'relative'}}>
            {t.label}
            {t.count!=null && t.count>0 && activeTab!==t.key && (
              <span style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:'var(--gold)',color:'#0F1117',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Active Ambassadors Tab ── */}
      {activeTab==='active' && (
        loading ? <div style={{padding:60,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Lade…</div>
        : ambassadors.length===0 ? (
          <div style={{padding:60,textAlign:'center',color:'var(--text-muted)'}}>
            <div style={{fontSize:40,marginBottom:12}}>🤝</div>
            <div style={{fontSize:13,marginBottom:8}}>Noch keine aktiven Ambassadors</div>
            <div style={{fontSize:11,color:'var(--text-muted)'}}>Nutzer suchen und manuell aktivieren → Tab „Nutzer suchen"</div>
          </div>
        ) : (
          <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1.8fr 1fr 1fr 1fr 90px',padding:'10px 16px',background:'var(--bg-tertiary)',borderBottom:'1px solid var(--border)'}}>
              {['Ambassador','Referral-Link','Level','Referrals','Umsatz',''].map(h=>(
                <div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</div>
              ))}
            </div>
            {ambassadors.map(a=>{
              const lc=LEVEL[a.level]||LEVEL.bronze;
              return (
                <div key={a.id} onClick={()=>setSelectedId(a.id)}
                  style={{display:'grid',gridTemplateColumns:'2fr 1.8fr 1fr 1fr 1fr 90px',padding:'12px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background 0.15s',borderLeft:('3px solid ' + lc.color)}}
                  onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-tertiary)')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                >
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <Avatar src={a.avatar_url as (string|null)} name={a.display_name||a.username} size={30} />
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--text-primary)'}}>{a.display_name||a.username}</div>
                      <div style={{fontSize:10,color:'var(--text-muted)'}}>seit {fmtDate(a.activated_at)}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center'}}>
                    <ReferralLinkCell link={a.referral_link} active={a.link_active} onCopy={()=>{navigator.clipboard.writeText(a.referral_link);showToast('Link kopiert','success');}} />
                  </div>
                  <div style={{display:'flex',alignItems:'center'}}><LevelBadge level={a.level} /></div>
                  <div style={{display:'flex',alignItems:'center',fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{a.referral_count}</div>
                  <div style={{display:'flex',alignItems:'center',fontSize:13,fontWeight:700,color:'var(--green)'}}>{fmtEur(a.revenue_generated)}</div>
                  <div style={{display:'flex',alignItems:'center'}}>
                    <button onClick={e=>{e.stopPropagation();setSelectedId(a.id);}} style={{padding:'4px 10px',borderRadius:7,border:'1px solid var(--border)',background:'var(--bg-tertiary)',color:'var(--text-muted)',cursor:'pointer',fontSize:11,fontFamily:'var(--font-body)'}}>Detail</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Applications Tab ── */}
      {activeTab==='applications' && (
        loading ? <div style={{padding:60,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Lade…</div>
        : applications.length===0 ? (
          <div style={{padding:60,textAlign:'center',color:'var(--text-muted)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📋</div>
            <div style={{fontSize:13}}>Keine offenen Anträge</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {applications.map(a=>{
              const userId = (a.user_id || a.id) as string;
              const appId  = (a.source === 'table' ? a.id : undefined) as string|undefined;
              const name   = [a.first_name, a.last_name].filter(Boolean).join(' ') || a.display_name || a.username;
              const motivation = a.motivation_text || a.motivation;
              const media = Array.isArray(a.media_urls) ? a.media_urls : [];
              const phone = (a as {phone?:string|null}).phone || null;
              const email = (a as {email?:string|null}).email || null;
              return (
              <div key={a.id} style={{background:'var(--bg-secondary)',border:'1px solid rgba(255,184,0,0.22)',borderLeft:'3px solid var(--gold)',borderRadius:14,overflow:'hidden'}}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'flex-start',gap:14,padding:'14px 16px 10px'}}>
                  <Avatar src={a.avatar_url as (string|null)} name={name} size={44} />
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--text-primary)',marginBottom:2}}>{name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>@{a.username} · {fmtDate((a.created_at || a.applied_at) as string)}</div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {a.age   && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'var(--bg-tertiary)',color:'var(--text-muted)',border:'1px solid var(--border)'}}>{a.age} J.</span>}
                      {a.gender && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'var(--bg-tertiary)',color:'var(--text-muted)',border:'1px solid var(--border)'}}>{a.gender}</span>}
                      {a.location && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'var(--bg-tertiary)',color:'var(--text-muted)',border:'1px solid var(--border)'}}>📍 {a.location}</span>}
                      {phone && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'rgba(78,205,196,0.07)',color:'var(--text-secondary)',border:'1px solid var(--border)'}}>📞 {phone}</span>}
                      {email && <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'rgba(78,205,196,0.07)',color:'var(--text-secondary)',border:'1px solid var(--border)'}}>✉️ {email}</span>}
                      {a.is_talent&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'rgba(78,205,196,0.1)',color:'var(--accent)',border:'1px solid rgba(78,205,196,0.3)',fontWeight:600}}>⭐ Wirker</span>}
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'rgba(255,184,0,0.1)',color:'var(--gold)',border:'1px solid rgba(255,184,0,0.3)'}}>📋 Antrag</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,flexShrink:0,flexDirection:'column',alignItems:'flex-end'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button disabled={acting} onClick={async()=>{
                        setActing(true);
                        const res=await fetch('/api/ambassador',{method:'POST',headers:{'Content-Type':'application/json', Authorization:'Bearer '+(getSessionToken()||'')},
                          body:JSON.stringify({action:'approve',user_id:userId,data:{application_id:appId}})});
                        if(res.ok){showToast('✅ Antrag genehmigt','success');load();}
                        else showToast('Fehler beim Genehmigen','error');
                        setActing(false);
                      }} style={{padding:'7px 14px',borderRadius:8,border:'1px solid var(--green)',background:'rgba(81,207,102,0.1)',color:'var(--green)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'var(--font-body)'}}>
                        ✅ Annehmen
                      </button>
                      <button disabled={acting} onClick={async()=>{
                        const reason=prompt('Ablehnungsgrund (optional):');
                        if(reason===null)return;
                        setActing(true);
                        const res=await fetch('/api/ambassador',{method:'POST',headers:{'Content-Type':'application/json', Authorization:'Bearer '+(getSessionToken()||'')},
                          body:JSON.stringify({action:'reject',user_id:userId,data:{reason,application_id:appId}})});
                        if(res.ok){showToast('Antrag abgelehnt','info');load();}
                        else showToast('Fehler','error');
                        setActing(false);
                      }} style={{padding:'7px 14px',borderRadius:8,border:'1px solid var(--red)',background:'rgba(255,99,99,0.08)',color:'var(--red)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'var(--font-body)'}}>
                        ❌ Ablehnen
                      </button>
                    </div>
                    <button onClick={()=>setSelectedId(userId)}
                      style={{padding:'5px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-tertiary)',color:'var(--text-muted)',cursor:'pointer',fontSize:11,fontFamily:'var(--font-body)'}}>
                      Details ansehen
                    </button>
                  </div>
                </div>

                {/* Motivation */}
                {motivation && (
                  <div style={{margin:'0 16px 12px',padding:'10px 14px',background:'var(--bg-tertiary)',borderRadius:10,fontSize:12,color:'var(--text-secondary)',lineHeight:1.65,borderLeft:'2px solid var(--gold)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'var(--gold)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Motivation</div>
                    {motivation}
                  </div>
                )}

                {/* Medien */}
                {media.length > 0 && (
                  <div style={{margin:'0 16px 14px'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>Medien ({media.length})</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {media.map((m, i) => (
                        <a key={i} href={typeof m === 'string' ? m : m.url} target="_blank" rel="noreferrer"
                          style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:'rgba(78,205,196,0.07)',border:'1px solid rgba(78,205,196,0.2)',borderRadius:8,fontSize:11,color:'var(--accent)',textDecoration:'none',fontWeight:600}}>
                          {(typeof m !== 'string' && m.type === 'video') ? '🎥' : '🖼️'}
                          {typeof m !== 'string' ? m.name : `Datei ${i+1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );})}
          </div>
        )
      )}

      {/* ── Search Tab ── */}
      {activeTab==='search' && (
        <div>
          <div style={{padding:'12px 16px',background:'rgba(78,205,196,0.06)',border:'1px solid rgba(78,205,196,0.2)',borderRadius:10,fontSize:11,color:'var(--text-secondary)',marginBottom:14,lineHeight:1.7}}>
            <strong style={{color:'var(--accent)'}}>🔍 Nutzer suchen</strong> — Suche per Name, Username oder E-Mail. Nutzer können direkt zum Ambassador aktiviert werden. Ein Referral-Link wird dabei automatisch generiert.
          </div>
          <div style={{position:'relative',marginBottom:14}}>
            <input
              value={search}
              onChange={e=>{setSearch(e.target.value);doSearch(e.target.value);}}
              placeholder="Name, Username oder E-Mail eingeben…"
              style={{...input,paddingLeft:36,maxWidth:440}}
            />
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,pointerEvents:'none',color:'var(--text-muted)'}}>🔍</span>
            {searchLoading&&<span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',fontSize:11,color:'var(--text-muted)'}}>…</span>}
          </div>

          {searchResults.length>0 && (
            <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
              {searchResults.map(u=>{
                const isAmb=u.is_ambassador;
                const isPending=u.ambassador_status==='pending';
                return (
                  <div key={u.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderBottom:'1px solid var(--border)'}}>
                    <Avatar src={u.avatar_url as (string|null)} name={u.display_name||u.username} size={36} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',marginBottom:2}}>{u.display_name||u.username}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:10,color:'var(--text-muted)'}}>@{u.username}</span>
                        {u.email&&<span style={{fontSize:10,color:'var(--text-muted)'}}>· {u.email}</span>}
                        {u.is_talent&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:'rgba(78,205,196,0.1)',color:'var(--accent)',border:'1px solid rgba(78,205,196,0.3)',fontWeight:600}}>⭐ Wirker</span>}
                        {isAmb&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:'rgba(81,207,102,0.1)',color:'var(--green)',border:'1px solid rgba(81,207,102,0.3)',fontWeight:600}}>✅ Ambassador</span>}
                        {isPending&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:'rgba(255,184,0,0.1)',color:'var(--gold)',border:'1px solid rgba(255,184,0,0.3)',fontWeight:600}}>📋 Antrag offen</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8,flexShrink:0}}>
                      {!isAmb&&(
                        <button disabled={acting} onClick={()=>manualActivate(u.id)}
                          style={{padding:'7px 14px',borderRadius:8,border:'1px solid var(--accent)',background:'var(--accent-dim)',color:'var(--accent)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'var(--font-body)'}}>
                          ⚡ Aktivieren
                        </button>
                      )}
                      {isAmb&&(
                        <button onClick={()=>setSelectedId(u.id)} style={{padding:'7px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-tertiary)',color:'var(--text-muted)',cursor:'pointer',fontSize:12,fontFamily:'var(--font-body)'}}>Detail</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {search.length>1&&searchResults.length===0&&!searchLoading&&(
            <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Kein Nutzer gefunden für „{search}"</div>
          )}
        </div>
      )}

      {/* ── Logs Tab ── */}
      {activeTab==='logs' && (
        logs.length===0 ? (
          <div style={{padding:60,textAlign:'center',color:'var(--text-muted)'}}>
            <div style={{fontSize:40,marginBottom:12}}>📋</div>
            <div style={{fontSize:13}}>Noch keine Aktivitäten protokolliert</div>
          </div>
        ) : (
          <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
            {logs.map((l,i)=>(
              <div key={l.id||i} style={{display:'flex',alignItems:'flex-start',gap:14,padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:18,flexShrink:0,marginTop:2}}>{LOG_ICONS[l.type]||'📌'}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--text-primary)',marginBottom:2}}>{l.type.replace(/_/g,' ')}</div>
                  {l.metadata&&Object.keys(l.metadata).length>0&&(
                    <div style={{fontSize:10,color:'var(--text-muted)',lineHeight:1.6}}>
                      {Object.entries(l.metadata).map(([k,v])=>`${k}: ${v}`).join(' · ')}
                    </div>
                  )}
                </div>
                <div style={{fontSize:10,color:'var(--text-muted)',flexShrink:0,textAlign:'right'}}>{fmtTime(l.created_at)}</div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Detail Drawer */}
      {selectedId&&(
        <AmbassadorDrawer ambId={selectedId} onClose={()=>setSelectedId(null)} onRefresh={load} />
      )}
    </DashboardLayout>
  );
}
