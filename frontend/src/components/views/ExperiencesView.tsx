// frontend/src/components/views/ExperiencesView.tsx
// ARCHITEKTUR-KERN: Single Source of Truth für Erlebnisse & Projekte.
// Superadmin (/experiences) und Employee (/employee/experiences) nutzen exakt dieselbe Komponente.
// Änderungen hier gelten automatisch für BEIDE Rollen.
'use client';
import { ImageLightbox, ClickableImage } from '@/components/ui/ImageLightbox';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';
import { useExperiences } from '@/lib/hooks/useExperiences';
import type { HuiEntry } from '@/lib/hooks/useExperiences';

type TabKey = 'all' | 'pending' | 'published' | 'rejected' | 'draft' | 'deleted' | 'sensitive';

function str(v: unknown): string { return v == null ? '—' : String(v); }
function bool(v: unknown): boolean { return Boolean(v); }

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30)  return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}

function isUpdated(entry: HuiEntry): boolean {
  const r = entry as Record<string, unknown>;
  // is_update kann boolean true oder string 'true' sein
  if (r.is_update === true || r.is_update === 'true') return true;
  if (!entry.last_submitted_at || !entry.created_at) return false;
  return new Date(str(entry.last_submitted_at)).getTime() > new Date(entry.created_at).getTime() + 5000;
}

// Echte DB-Status: pending_review | published (keine approval_status-Spalte in experiences)
function normStatus(e: HuiEntry): string {
  const s = (e as unknown as {status?:string}).status ?? '';
  if (s === 'pending_review') return 'pending';
  if (s === 'published')      return 'published';
  if (s === 'rejected')       return 'rejected';
  if (s === 'draft')          return 'draft';
  if (s === 'deleted')        return 'deleted';
  return s || 'unknown';
}

const isPending   = (e: HuiEntry) => normStatus(e) === 'pending';
const isApproved  = (e: HuiEntry) => { const ns = normStatus(e); return ns === 'approved' || ns === 'published'; };
const isRejected  = (e: HuiEntry) => normStatus(e) === 'rejected';
const isDraft     = (e: HuiEntry) => normStatus(e) === 'draft';
const isDeleted   = (e: HuiEntry) => normStatus(e) === 'deleted';
// ── Sensitive-Erkennung (identisch zu works) ────────────────────────────
const EXP_SENSITIVE_KEYWORDS: { kw: string; cat: string }[] = [
  // Sexuelle Inhalte
  { kw:'porno',       cat:'🔞 Sexuell' }, { kw:'porn',        cat:'🔞 Sexuell' },
  { kw:'sex',         cat:'🔞 Sexuell' }, { kw:'blowjob',     cat:'🔞 Sexuell' },
  { kw:'anal',        cat:'🔞 Sexuell' }, { kw:'oral',        cat:'🔞 Sexuell' },
  { kw:'nackt',       cat:'🔞 Sexuell' }, { kw:'nude',        cat:'🔞 Sexuell' },
  { kw:'nudes',       cat:'🔞 Sexuell' }, { kw:'penis',       cat:'🔞 Sexuell' },
  { kw:'vagina',      cat:'🔞 Sexuell' }, { kw:'tits',        cat:'🔞 Sexuell' },
  { kw:'dick',        cat:'🔞 Sexuell' }, { kw:'pussy',       cat:'🔞 Sexuell' },
  { kw:'bdsm',        cat:'🔞 Sexuell' }, { kw:'fetisch',     cat:'🔞 Sexuell' },
  { kw:'escort',      cat:'🔞 Sexuell' }, { kw:'prostituierte', cat:'🔞 Sexuell' },
  { kw:'erotik',      cat:'🔞 Sexuell' }, { kw:'18+',         cat:'🔞 Sexuell' },
  { kw:'adult',       cat:'🔞 Sexuell' }, { kw:'xxx',         cat:'🔞 Sexuell' },
  { kw:'cum',         cat:'🔞 Sexuell' }, { kw:'sperma',      cat:'🔞 Sexuell' },
  // Gewalt
  { kw:'töten',       cat:'⚠️ Gewalt'  }, { kw:'ermorden',    cat:'⚠️ Gewalt'  },
  { kw:'umbringen',   cat:'⚠️ Gewalt'  }, { kw:'schlagen',    cat:'⚠️ Gewalt'  },
  { kw:'verletzen',   cat:'⚠️ Gewalt'  }, { kw:'prügeln',     cat:'⚠️ Gewalt'  },
  { kw:'blutbad',     cat:'⚠️ Gewalt'  }, { kw:'folter',      cat:'⚠️ Gewalt'  },
  { kw:'vergewaltigung', cat:'⚠️ Gewalt' }, { kw:'waffe',     cat:'⚠️ Gewalt'  },
  { kw:'pistole',     cat:'⚠️ Gewalt'  }, { kw:'gewehr',      cat:'⚠️ Gewalt'  },
  { kw:'messer',      cat:'⚠️ Gewalt'  }, { kw:'gun',         cat:'⚠️ Gewalt'  },
  { kw:'terror',      cat:'⚠️ Gewalt'  },
  // Rassismus / Extremismus
  { kw:'nazi',        cat:'🚫 Extremismus' }, { kw:'hitler',  cat:'🚫 Extremismus' },
  { kw:'jihad',       cat:'🚫 Extremismus' }, { kw:'isis',    cat:'🚫 Extremismus' },
  { kw:'taliban',     cat:'🚫 Extremismus' }, { kw:'ausländer raus', cat:'🚫 Hassrede' },
  { kw:'antisemit',   cat:'🚫 Hassrede' },
  // Drogen
  { kw:'kokain',      cat:'💊 Drogen'  }, { kw:'heroin',      cat:'💊 Drogen'  },
  { kw:'meth',        cat:'💊 Drogen'  }, { kw:'crystal',     cat:'💊 Drogen'  },
  { kw:'droge',       cat:'💊 Drogen'  }, { kw:'drug',        cat:'💊 Drogen'  },
  { kw:'cannabis',    cat:'💊 Drogen'  },
  // Selbstverletzung
  { kw:'suizid',      cat:'🆘 Selbstverletzung' }, { kw:'selbstmord', cat:'🆘 Selbstverletzung' },
  { kw:'ritzen',      cat:'🆘 Selbstverletzung' },
  // Illegal
  { kw:'betrug',      cat:'🚨 Illegal' }, { kw:'fraud',       cat:'🚨 Illegal' },
  { kw:'scam',        cat:'🚨 Illegal' }, { kw:'hack',        cat:'🚨 Illegal' },
  { kw:'geldwäsche',  cat:'🚨 Illegal' }, { kw:'money launder', cat:'🚨 Illegal' },
];
// ── DB-Keywords Loader (shared mit works) ─────────────────────────────
interface DbKwEntry { kw?: string; keyword?: string; cat?: string; category?: string; severity?: number; }
let _expDbKeywords: DbKwEntry[] = [];
let _expDbLoaded = false;
function expCatLabel(cat: string): string {
  const map: Record<string,string> = {
    sexual_text:'🔞 Sexuell', sexual_image:'🔞 Sexuell (Bild)',
    violence_text:'⚠️ Gewalt', violence_image:'⚠️ Gewalt (Bild)',
    racism_hate:'🚫 Hassrede', extremism:'🚫 Extremismus',
    discrimination:'🚫 Diskriminierung', self_harm:'🆘 Selbstverletzung',
    drugs:'💊 Drogen', illegal_activity:'🚨 Illegal',
    dangerous_behavior:'⚡ Gefährlich', emojis:'🚨 Symbol', toxic_slang:'🚫 Toxisch',
  };
  return map[cat] || `⚠️ ${cat}`;
}
async function loadExpDbKeywords(): Promise<void> {
  if (_expDbLoaded) return;
  try {
    const res = await fetch('/api/sensitive-keywords', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json() as { keyword: string; category: string; severity: number }[];
      _expDbKeywords = data.map(d => ({ kw: d.keyword, keyword: d.keyword, cat: expCatLabel(d.category), category: d.category, severity: d.severity }));
      _expDbLoaded = true;
    }
  } catch { /* graceful fallback */ }
}

function detectSensitiveExp(e: HuiEntry): { flagged: boolean; reasons: string[] } {
  // Admin-gesetzter Status hat Vorrang
  const eRec = e as Record<string,unknown>;
  if (eRec.sensitivity_status === 'flagged' && eRec.sensitivity_reason) {
    return { flagged: true, reasons: [String(eRec.sensitivity_reason)] };
  }
  if (eRec.sensitivity_status === 'cleared') {
    return { flagged: false, reasons: [] };
  }

  const reasons: string[] = [];
  const text = [e.title||'', e.description||'', str(e.category), str(eRec.location_text||'')].join(' ').toLowerCase();
  const seen = new Set<string>();

  // Hardcoded Fallback-Liste
  for (const { kw, cat } of EXP_SENSITIVE_KEYWORDS) {
    if (text.includes(kw) && !seen.has(cat)) { seen.add(cat); reasons.push(`${cat}: "${kw}"`); }
  }
  // DB-Keywords (wenn geladen)
  for (const d of _expDbKeywords) {
    const kw = (d.kw || d.keyword || '').toLowerCase();
    const cat = d.cat || expCatLabel(d.category || '');
    if (kw && text.includes(kw) && !seen.has(cat)) { seen.add(cat); reasons.push(`${cat}: "${kw}"`); }
  }

  if (!e.title || String(e.title).trim().length < 2) reasons.push('⚠️ Fehlender Titel');
  return { flagged: reasons.length > 0, reasons };
}
const isSensitive = (e: HuiEntry) => detectSensitiveExp(e).flagged;

// ── Diff-Hilfsfunktionen ──────────────────────────────────────────────────
function parseSnapshot(entry: HuiEntry): Record<string, unknown> | null {
  // admin_comment kann über direkten Typ oder Record-Index kommen
  const raw = entry.admin_comment ?? (entry as Record<string, unknown>).admin_comment;
  if (typeof raw !== 'string' || !raw.startsWith('__snapshot__:')) return null;
  try { return JSON.parse(raw.slice('__snapshot__:'.length)); }
  catch { return null; }
}
function valStr(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return (v as unknown[]).join(', ') || '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function isDiffVal(a: unknown, b: unknown): boolean { return valStr(a) !== valStr(b); }

function DiffFieldExp({ label, newVal, oldVal }: { label: string; newVal: unknown; oldVal?: unknown }) {
  const [hov, setHov] = useState(false);
  const changed = oldVal !== undefined && isDiffVal(newVal, oldVal);
  const nStr = valStr(newVal); const oStr = valStr(oldVal);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        padding: '8px 12px',
        background: changed ? '#FFF7C2' : 'var(--bg-tertiary)',
        borderRadius: 6,
        borderLeft: changed ? '4px solid #FFB300' : '4px solid transparent',
        position: 'relative',
        cursor: changed ? 'help' : 'default',
        transition: 'background 0.15s',
      }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:4 }}>
        <div style={{
          fontSize: 10,
          color: changed ? '#9a6700' : 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 3,
          fontWeight: changed ? 700 : 400,
        }}>{label}</div>
        {changed && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            color: '#fff',
            background: '#FFB300',
            padding: '2px 7px',
            borderRadius: 10,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            letterSpacing: '0.3px',
          }}>Geändert</span>
        )}
      </div>
      <div style={{ fontSize:12, color:'var(--text-primary)', fontWeight:500, wordBreak:'break-all', lineHeight:1.4 }}>{nStr}</div>
      {changed && hov && (
        <div style={{
          position: 'absolute', bottom: '110%', left: 0, zIndex: 9999,
          background: '#333', color: '#fff',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 11,
          minWidth: 200, maxWidth: 300,
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          lineHeight: 1.5,
        }}>
          <div style={{ marginBottom: 4, opacity: 0.7, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>ALT</div>
          <div style={{ color: '#ff8a80', wordBreak: 'break-word', marginBottom: 6 }}>{oStr || '—'}</div>
          <div style={{ marginBottom: 4, opacity: 0.7, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>NEU</div>
          <div style={{ color: '#69f0ae', wordBreak: 'break-word' }}>{nStr}</div>
        </div>
      )}
    </div>
  );
}

function MediaDiffBlockExp({ entry, snap }: { entry: HuiEntry; snap: Record<string,unknown>|null }) {
  if (!snap) return null;
  const toUrls = (arr: unknown): string[] => ((arr as unknown[])||[]).map((i:unknown)=>
    typeof i==='object'&&i!==null?(i as Record<string,string>).url||'':String(i)).filter(Boolean);
  const newImgs = toUrls(entry.images); const oldImgs = toUrls(snap.images);
  const nc = (entry.cover_url as string)||newImgs[0]||'';
  const oc = (snap.cover_url as string)||oldImgs[0]||'';
  if (nc===oc && JSON.stringify(newImgs)===JSON.stringify(oldImgs)) return null;
  return (
    <div style={{
      padding: '10px 14px',
      background: '#FFF7C2',
      borderLeft: '4px solid #FFB300',
      borderRadius: 6,
      marginBottom: 4,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:10, color:'#9a6700', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>
          📷 Medien
        </div>
        <span style={{ fontSize:9, fontWeight:700, color:'#fff', background:'#FFB300', padding:'2px 7px', borderRadius:10 }}>Geändert</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div>
          <div style={{ fontSize:10, color:'#666', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>ALT</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {oldImgs.length>0 ? oldImgs.slice(0,4).map((url,i)=>(
              <div key={i} style={{ width:64,height:64,borderRadius:6,overflow:'hidden',background:'#e0e0e0',border:'1px solid #ccc',opacity:0.75 }}>
                <img src={url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
              </div>
            )) : <div style={{ fontSize:11, color:'#999', padding:'8px 0' }}>Kein Bild</div>}
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:'#9a6700', marginBottom:6, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px' }}>NEU</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {newImgs.length>0 ? newImgs.slice(0,4).map((url,i)=>(
              <div key={i} style={{ width:64,height:64,borderRadius:6,overflow:'hidden',background:'#FFF7C2',border:'2px solid #FFB300' }}>
                <img src={url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
              </div>
            )) : <div style={{ fontSize:11, color:'#999', padding:'8px 0' }}>Kein Bild</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

async function entryAction(action: string, id: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: id, data }),
    });
    return res.ok;
  } catch { return false; }
}

function EntryStatus({ entry }: { entry: HuiEntry }) {
  const ns  = normStatus(entry);
  const upd = isUpdated(entry);
  if (ns === 'approved' || ns === 'published') return (
    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
      <Badge variant="success" dot>Published</Badge>
      {upd && <span style={{ fontSize:9, color:'#F59E0B', fontWeight:700 }}>↻ Upd.</span>}
    </span>
  );
  if (ns === 'pending') return (
    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
      <Badge variant="warning" dot>⏳ Eingereicht</Badge>
      {upd && <span style={{ fontSize:9, color:'#F59E0B', fontWeight:700 }}>↻ Akt.</span>}
    </span>
  );
  if (ns === 'rejected') return <Badge variant="danger"  dot>❌ Abgelehnt</Badge>;
  if (ns === 'draft')    return <Badge variant="neutral" dot>Draft</Badge>;
  if (ns === 'deleted')  return <Badge variant="neutral">🗑 Gelöscht</Badge>;
  return <Badge variant="neutral">{str(entry.status)}</Badge>;
}

function SourceBadge({ source }: { source: string }) {
  const isExp = source === 'experiences';
  return (
    <span style={{
      fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4, letterSpacing:'0.5px',
      textTransform:'uppercase' as const,
      background: isExp ? 'rgba(78,205,196,0.12)' : 'rgba(147,112,219,0.12)',
      color: isExp ? 'var(--accent)' : '#9370DB',
      border: `1px solid ${isExp ? 'rgba(78,205,196,0.3)' : 'rgba(147,112,219,0.3)'}`,
    }}>{isExp ? 'Erlebnis' : 'Projekt'}</span>
  );
}

function Skel() {
  return (
    <tr>{[...Array(7)].map((_,i) => (
      <td key={i} style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ height:11, background:'var(--bg-tertiary)', borderRadius:4, animation:'pulse 2s ease-in-out infinite', width:i===0?'70%':'50%' }}/>
      </td>
    ))}</tr>
  );
}

function TabBar({ tab, setTab, counts }: { tab:TabKey; setTab:(t:TabKey)=>void; counts:Record<TabKey,number>; }) {
  const TABS: {key:TabKey; label:string; icon:string; danger?:boolean}[] = [
    { key:'all',       label:'Alle',        icon:'' },
    { key:'pending',   label:'Eingereicht', icon:'⏳' },
    { key:'published', label:'Published',   icon:'●' },
    { key:'rejected',  label:'Abgelehnt',   icon:'✕', danger:true },
    { key:'draft',     label:'Draft',       icon:'' },
    { key:'deleted',   label:'Gelöscht',    icon:'🗑' },
    { key:'sensitive', label:'Sensitiv',    icon:'⚠️', danger:true },
  ];
  return (
    <div style={{ display:'flex', gap:4, marginBottom:14, borderBottom:'1px solid var(--border)', paddingBottom:10, flexWrap:'wrap' }}>
      {TABS.map(({key,label,icon,danger}) => {
        const active = tab===key;
        const col = key==='pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)';
        const bg  = key==='pending' ? 'rgba(245,158,11,0.12)' : danger ? 'var(--red-dim)' : 'var(--accent-dim)';
        const cnt = counts[key];
        return (
          <button key={key} onClick={()=>setTab(key)} style={{
            padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:active?600:400,
            border:`1px solid ${active?col:'var(--border)'}`,
            background:active?bg:'var(--bg-secondary)', color:active?col:'var(--text-secondary)',
            cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.15s',
            display:'flex', alignItems:'center', gap:5,
          }}>
            {icon && <span style={{ fontSize:10 }}>{icon}</span>}
            {label}
            {cnt > 0 && (
              <span style={{
                minWidth:18, height:18, borderRadius:9, fontSize:10, fontWeight:700, padding:'0 4px',
                background:active?col:(key==='pending'?'#F59E0B':danger?'var(--red)':'var(--bg-tertiary)'),
                color:active?'#fff':(key==='pending'||danger?'#fff':'var(--text-secondary)'),
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>{cnt}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Kachel({ label, value, color }: { label:string; value:number; color:string }) {
  return (
    <div style={{ flex:1, minWidth:100, padding:'14px 16px', background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10 }}>
      <div style={{ fontSize:22, fontWeight:700, color, marginBottom:2 }}>{value.toLocaleString('de-DE')}</div>
      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px' }}>{label}</div>
    </div>
  );
}

function CoverImages({ entry, onOpenLightbox }: { entry: HuiEntry; onOpenLightbox: (images: string[], index: number) => void }) {
  const r   = entry as Record<string, unknown>;
  const cv  = typeof r.cover_url === 'string' ? r.cover_url : undefined;
  const raw = typeof r.images    === 'string' ? r.images    : '[]';
  let imgs: string[] = [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) imgs = (p as Record<string,unknown>[]).map(x => str(x.url || x)).filter(u => u !== '—');
  } catch { /* ignore */ }
  const all = cv ? [cv, ...imgs.filter(u => u !== cv)] : imgs;
  if (!all.length) return (
    <div style={{ height:70, background:'var(--bg-tertiary)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:12, border:'1px solid var(--border)' }}>
      📷 Kein Bild
    </div>
  );
  return (
    <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
      {all.slice(0,5).map((url,i) => (
        <div key={i} style={{ flexShrink:0, width:i===0?180:80, height:i===0?120:80, borderRadius:8, overflow:'hidden', background:'var(--bg-tertiary)', border:`${i===0?2:1}px solid ${i===0?'var(--accent)':'var(--border)'}` }}>
          <ClickableImage
            src={url} alt=""
            style={{ width:'100%', height:'100%', objectFit:'cover' }}
            containerStyle={{ width:'100%', height:'100%' }}
            onOpenLightbox={() => onOpenLightbox(all, i)}
            onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}
          />
        </div>
      ))}
    </div>
  );
}

export function ErlebnisseProjekteView({ role = 'superadmin' }: { role?: 'superadmin' | 'employee' }) {
  const [tab,           setTab]          = useState<TabKey>('all');
  const isSuperadmin = role === 'superadmin';
  // ── Lightbox State (einzige Instanz für Superadmin + Employee) ─────────────
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const openLightbox = (images: string[], index = 0) => { setLightboxImages(images); setLightboxIndex(index); };
  const closeLightbox = () => setLightboxImages([]);
  const [search,        setSearch]       = useState('');
  const [selected,      setSelected]     = useState<HuiEntry|null>(null);
  const [showDetail,    setShowDetail]   = useState(false);
  const [rejectTarget,  setRejectTarget] = useState<HuiEntry|null>(null);
  const [rejectReason,  setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading]= useState(false);
  const [deleteTarget,  setDeleteTarget] = useState<HuiEntry|null>(null);
  const [localDel,      setLocalDel]     = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading]= useState<string|null>(null);

  const { entries: all, loading, refetch } = useExperiences({ limit:1000, refreshInterval:0 }); // kein status-Filter → alle laden
  const refetchAll = useCallback(() => refetch(), [refetch]);

  const counts = useMemo<Record<TabKey,number>>(() => ({
    all:       all.filter(e=>!isDeleted(e)).length,
    published: all.filter(e=>isApproved(e)).length,
    pending:   all.filter(e=>isPending(e)).length,
    rejected:  all.filter(e=>isRejected(e)).length,
    draft:     all.filter(e=>isDraft(e)).length,
    deleted:   all.filter(e=>isDeleted(e)).length,
    sensitive: all.filter(e=>!isDeleted(e) && detectSensitiveExp(e).flagged).length,
  }), [all]);

  const rows = useMemo(() => {
    const visible = all.filter(e => !localDel.has(e.id));
    let base: HuiEntry[];
    if      (tab==='pending')   base = visible.filter(e=>isPending(e));
    else if (tab==='published') base = visible.filter(e=>isApproved(e));
    else if (tab==='rejected')  base = visible.filter(e=>isRejected(e));
    else if (tab==='draft')     base = visible.filter(e=>isDraft(e));
    else if (tab==='deleted')   base = visible.filter(e=>isDeleted(e));
    else if (tab==='sensitive') base = visible.filter(e=>!isDeleted(e) && detectSensitiveExp(e).flagged);
    else                        base = visible.filter(e=>!isDeleted(e)); // 'all' → alles außer gelöscht
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(e => [e.title,e.category,e.description].some(v=>(v||'').toLowerCase().includes(q)));
  }, [tab, search, all, localDel]);

  const handleApprove = async (e: HuiEntry) => {
    setActionLoading(e.id);
    const ok = await entryAction(e._source==='experiences'?'approve_experience':'approve_project', e.id);
    setActionLoading(null);
    if (ok) {
      // Optimistic update: Status sofort in UI aktualisieren ohne auf refetch zu warten
      setSelected(prev => prev?.id === e.id
        ? { ...prev, status: 'published', approval_status: 'approved', rejection_reason: null }
        : prev);
      showToast(`✅ Freigegeben: ${e.title||'Eintrag'}`, 'success');
      // Sofort refetch ohne Verzögerung
      await refetchAll();
    }
    else {
      showToast('Fehler beim Freigeben', 'error');
    }
  };

  // ── Clear Sensitive Flag ──────────────────────────────────────────────
  const handleClearSensitive = async (e: HuiEntry) => {
    setActionLoading(e.id);
    const action = e._source === 'experiences' ? 'clear_sensitive_experience' : 'clear_sensitive_project';
    const ok = await entryAction(action, e.id);
    setActionLoading(null);
    if (ok) {
      showToast('✅ Sensitiv-Flag entfernt', 'success');
      // Optimistic update
      setSelected(prev => prev?.id === e.id
        ? { ...prev, sensitivity_status: 'cleared', sensitivity_reason: null } as HuiEntry
        : prev);
      await refetchAll();
    } else {
      showToast('Fehler beim Entfernen', 'error');
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) { showToast('Bitte Ablehnungsgrund angeben','error'); return; }
    setRejectLoading(true);
    const ok = await entryAction(rejectTarget._source==='experiences'?'reject_experience':'reject_project', rejectTarget.id, {reason});
    setRejectLoading(false);
    if (ok) {
      setSelected(prev => prev?.id === rejectTarget.id
        ? { ...prev, status: 'rejected', approval_status: 'rejected', rejection_reason: rejectReason }
        : prev);
      showToast(`❌ Abgelehnt: ${rejectTarget.title||'Eintrag'}`, 'info'); setRejectTarget(null); setRejectReason(''); refetchAll(); }
    else showToast('Fehler beim Ablehnen','error');
  };

  const handleDelete = async (e: HuiEntry) => {
    setLocalDel(p => new Set([...p, e.id]));
    setDeleteTarget(null);
    setActionLoading(e.id);
    const ok = await entryAction('delete_experience', e.id);
    setActionLoading(null);
    if (ok) {
      showToast('Geloescht! Der Eintrag ist nicht mehr in der App sichtbar.', 'info');
      setLocalDel(new Set());
      await refetchAll();
    } else {
      showToast('Fehler beim Loeschen.', 'error');
      setLocalDel(p => { const s = new Set(p); s.delete(e.id); return s; });
    }
  };

  const handleRestore = async (e: HuiEntry) => {
    setActionLoading(e.id);
    const ok = await entryAction('restore_experience', e.id);
    setActionLoading(null);
    if (ok) { showToast('Wiederhergestellt! Der Eintrag ist wieder live.', 'success'); await refetchAll(); }
    else { showToast('Fehler beim Wiederherstellen.', 'error'); }
  };

  const handleHardDelete = async (e: HuiEntry) => {
    setActionLoading(e.id);
    const ok = await entryAction('hard_delete_experience', e.id);
    setActionLoading(null);
    if (ok) { showToast('Endgueltig geloescht.', 'info'); await refetchAll(); }
    else { showToast('Fehler.', 'error'); }
  };

  const BANNERS: Partial<Record<TabKey,{bg:string;border:string;color:string;text:string}>> = {
    pending:   {bg:'rgba(245,158,11,0.08)',  border:'#F59E0B',    color:'#F59E0B',    text:'⏳ Diese Erlebnisse & Projekte warten auf Freigabe.'},
    rejected:  {bg:'rgba(255,107,107,0.06)', border:'var(--red)', color:'var(--red)', text:'❌ Abgelehnte Einträge. Nutzer können sie überarbeiten.'},
    deleted:   {bg:'rgba(255,107,107,0.06)', border:'var(--red)', color:'var(--red)', text:'🗑 Gelöschte Einträge.'},
    sensitive: {bg:'rgba(247,183,49,0.08)',  border:'var(--gold)',color:'var(--gold)',text:'⚠️ Einträge mit verdächtigen Keywords oder fehlenden Pflichtfeldern. Prüfe jeden Eintrag.'},
  };
  const banner = BANNERS[tab];

  return (
    <DashboardLayout title="Erlebnisse & Projekte">
      <div style={{ padding:'24px 28px', maxWidth:1400, margin:'0 auto' }}>



        <div style={{ display:'flex', gap:10, marginBottom:22, flexWrap:'wrap' }}>
          <Kachel label="Erlebnisse"  value={all.filter(e=>e._source==='experiences').length} color="var(--accent)" />
          <Kachel label="Projekte"    value={all.filter(e=>e._source==='projects').length}    color="#9370DB"       />
          <Kachel label="Published"   value={counts.published}  color="var(--green)"      />
          <Kachel label="Eingereicht" value={counts.pending}    color="#F59E0B"           />
          <Kachel label="Abgelehnt"   value={counts.rejected}   color="var(--red)"        />
          <Kachel label="Gelöscht"    value={counts.deleted}    color="var(--text-muted)" />
          {counts.sensitive > 0 && <Kachel label="⚠️ Sensitiv" value={counts.sensitive} color="var(--red)" />}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:220 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:14 }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Titel, Kategorie, Beschreibung …"
              style={{ width:'100%', padding:'8px 10px 8px 32px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12, fontFamily:'var(--font-body)', outline:'none', boxSizing:'border-box' }}/>
          </div>
          {counts.pending > 0 && (
            <button onClick={() => setTab('pending')} style={{ fontSize:11, background:'rgba(245,158,11,0.12)', color:'#F59E0B', padding:'4px 10px', borderRadius:20, border:'1px solid #F59E0B', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              ⏳ {counts.pending} eingereicht
            </button>
          )}
          {counts.sensitive > 0 && (
            <button onClick={() => setTab('sensitive')} style={{ fontSize:11, background:'rgba(255,107,107,0.1)', color:'var(--red)', padding:'4px 10px', borderRadius:20, border:'1px solid var(--red)', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              ⚠️ {counts.sensitive} sensitiv
            </button>
          )}
          <button onClick={refetchAll} style={{ padding:'8px 14px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)' }}>↻ Aktualisieren</button>
        </div>

        <TabBar tab={tab} setTab={setTab} counts={counts} />

        {banner && (
          <div style={{ marginBottom:14, padding:'10px 14px', background:banner.bg, border:`1px solid ${banner.border}`, borderRadius:8, fontSize:12, color:banner.color, fontWeight:500 }}>{banner.text}</div>
        )}

        <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--bg-tertiary)', borderBottom:'1px solid var(--border)' }}>
                  {['Titel','Typ','Status','Preis','Kategorie','Erstellt',''].map(h=>(
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !all.length
                  ? [...Array(5)].map((_,i)=><Skel key={i}/>)
                  : rows.length===0
                    ? <tr><td colSpan={7} style={{ padding:'40px', textAlign:'center', color:'var(--text-muted)' }}>{search?`Keine Treffer für „${search}"`:'Keine Einträge in dieser Kategorie'}</td></tr>
                    : rows.map(entry=>(
                      <tr key={entry.id}
                        onClick={()=>{setSelected(entry);setShowDetail(true);}}
                        style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.12s',
                          background: detectSensitiveExp(entry).flagged ? 'rgba(255,107,107,0.02)' : undefined }}
                        onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-tertiary)'}
                        onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=detectSensitiveExp(entry).flagged?'rgba(255,107,107,0.02)':''}
                      >
                        <td style={{ padding:'10px 12px', maxWidth:200 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>
                              {entry.title||<span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Kein Titel</span>}
                            </span>
                            {isUpdated(entry)&&<span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.15)', color:'#F59E0B', fontWeight:700 }}>↻ UPD</span>}
                            {detectSensitiveExp(entry).flagged&&<span title={detectSensitiveExp(entry).reasons.join('\n')} style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(255,107,107,0.12)', color:'var(--red)', fontWeight:700, cursor:'help' }}>⚠️</span>}
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px' }}><SourceBadge source={entry._source||'experiences'}/></td>
                        <td style={{ padding:'10px 12px' }}><EntryStatus entry={entry}/></td>
                        <td style={{ padding:'10px 12px', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{entry.price?`€${Number(entry.price).toLocaleString('de-DE')}`:'—'}</td>
                        <td style={{ padding:'10px 12px', color:'var(--text-secondary)' }}>{str(entry.category)}</td>
                        <td style={{ padding:'10px 12px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{timeAgo(entry.created_at)}</td>
                        <td style={{ padding:'10px 12px' }} onClick={e=>e.stopPropagation()}>
                          <div style={{ display:'flex', gap:4 }}>
                            {isPending(entry)&&<>
                              <button disabled={actionLoading===entry.id} onClick={()=>handleApprove(entry)} title="Freigeben"
                                style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--accent)', background:'var(--accent-dim)', color:'var(--accent)', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                                {actionLoading===entry.id?'…':'✅'}
                              </button>
                              <button onClick={()=>{setRejectTarget(entry);setRejectReason('');}} title="Ablehnen"
                                style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)' }}>❌</button>
                            </>}
                            {isRejected(entry)&&<button onClick={()=>handleApprove(entry)} title="Trotzdem freigeben"
                              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--accent)', background:'var(--accent-dim)', color:'var(--accent)', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)' }}>✅</button>}
                            {/* Sensitiv-Flag-Entfernen Button — nur wenn flagged */}
                            {tab==='sensitive' && detectSensitiveExp(entry).flagged && (
                              <button
                                disabled={actionLoading===entry.id}
                                onClick={e=>{e.stopPropagation(); handleClearSensitive(entry);}}
                                title="Sensitiv-Flag entfernen"
                                style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #22C55E', background:'rgba(34,197,94,0.1)', color:'#22C55E', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:600 }}>
                                {actionLoading===entry.id?'…':'✅ Klar'}
                              </button>
                            )}
                            {isSuperadmin && (
                            <button onClick={()=>setDeleteTarget(entry)} title="Löschen"
                              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-muted)', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)' }}>🗑</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-tertiary)' }}>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{rows.length} Einträge angezeigt{search&&` (gefiltert aus ${all.length})`}</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Gesamt: {all.length.toLocaleString('de-DE')} Datensätze</span>
          </div>
        </div>

        {/* ── Detail Modal ── */}
        <Modal open={showDetail&&selected!==null}
          title={selected?`${selected._source==='experiences'?'🌿 Erlebnis':'📌 Projekt'}: ${selected.title||'Kein Titel'}`:'Erlebnis Details'}
          width={700} onClose={()=>setShowDetail(false)}
          footer={selected?(
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Button variant="ghost" onClick={()=>setShowDetail(false)} disabled={!!actionLoading}>Schließen</Button>
              {isPending(selected)&&<Button variant="primary" loading={actionLoading===selected.id} disabled={!!actionLoading} onClick={()=>handleApprove(selected)}>✅ Freigeben</Button>}
              {isPending(selected)&&<Button variant="danger" disabled={!!actionLoading} onClick={()=>{if(actionLoading)return;setShowDetail(false);setRejectTarget(selected);setRejectReason('');}}>❌ Ablehnen</Button>}
              {isRejected(selected)&&<Button variant="primary" loading={actionLoading===selected.id} disabled={!!actionLoading} onClick={()=>handleApprove(selected)}>✅ Trotzdem freigeben</Button>}
              {!isDeleted(selected)&&isSuperadmin&&<Button variant="danger" disabled={!!actionLoading} onClick={()=>{if(actionLoading)return;setShowDetail(false);setDeleteTarget(selected);}}>Loeschen</Button>}
              {isDeleted(selected)&&<Button variant="primary" loading={actionLoading===selected.id} disabled={!!actionLoading} onClick={()=>handleRestore(selected)}>Wiederherstellen</Button>}
              {isDeleted(selected)&&isSuperadmin&&<Button variant="danger" disabled={!!actionLoading} onClick={()=>{if(window.confirm('Endgueltig loeschen?')){setShowDetail(false);handleHardDelete(selected);}}}>Final loeschen</Button>}
            </div>
          ):undefined}
        >
          {selected&&(
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {isUpdated(selected)&&(
                <div style={{ padding:'10px 14px', background:'rgba(245,158,11,0.08)', border:'1px solid #F59E0B', borderRadius:8, display:'flex', gap:10 }}>
                  <span style={{ fontSize:16 }}>↻</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#F59E0B', marginBottom:2 }}>Update eines bereits eingereichten Eintrags</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>
                      Nutzer hat überarbeitet und erneut eingereicht.
                      {bool(selected.last_submitted_at)&&` Letzte Einreichung: ${new Date(str(selected.last_submitted_at)).toLocaleString('de-DE')}`}
                    </div>
                  </div>
                </div>
              )}
              {isApproved(selected)&&(
                <div style={{ padding:'10px 14px', background:'rgba(14,196,184,0.08)', border:'1px solid var(--accent)', borderRadius:8, fontSize:12, color:'var(--accent)', fontWeight:600 }}>
                  ✅ Freigegeben — dieser Eintrag ist jetzt öffentlich sichtbar.
                </div>
              )}
              {isPending(selected)&&!isUpdated(selected)&&!isApproved(selected)&&(
                <div style={{ padding:'10px 14px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:8, fontSize:12, color:'#F59E0B', fontWeight:500 }}>
                  ⏳ Erste Einreichung — wartet auf Freigabe.
                </div>
              )}
              {isRejected(selected)&&(
                <div style={{ padding:'10px 14px', background:'rgba(255,107,107,0.06)', border:'1px solid var(--red)', borderRadius:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--red)', marginBottom:4 }}>❌ Abgelehnter Eintrag</div>
                  {bool(selected.rejection_reason)&&(
                    <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.5 }}>
                      <span style={{ color:'var(--text-muted)' }}>Ablehnungsgrund: </span>{str(selected.rejection_reason)}
                    </div>
                  )}
                </div>
              )}
              {/* Sensitive alert */}
              {detectSensitiveExp(selected).flagged && (
                <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(255,107,107,0.08)', border:'1px solid var(--red)', borderRadius:8 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--red)' }}>⚠️ Sensitiver Inhalt erkannt</div>
                    <button
                      onClick={() => handleClearSensitive(selected)}
                      disabled={actionLoading === selected.id}
                      style={{
                        fontSize:11, padding:'3px 10px', borderRadius:20,
                        background:'rgba(34,197,94,0.1)', color:'#22C55E',
                        border:'1px solid #22C55E', cursor:'pointer',
                        fontWeight:600, fontFamily:'var(--font-body)'
                      }}
                      title="Flag entfernen — Inhalt wurde geprüft und ist unbedenklich"
                    >
                      {actionLoading === selected.id ? '…' : '✅ Flag entfernen'}
                    </button>
                  </div>
                  {detectSensitiveExp(selected).reasons.map((r, i) => (
                    <div key={i} style={{ fontSize:11, color:'var(--red)', marginTop:2, opacity:0.9 }}>• {r}</div>
                  ))}
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>
                    Nach dem Entfernen wird der Eintrag nicht mehr im Sensitiv-Tab angezeigt.
                  </div>
                </div>
              )}
              {(selected as Record<string,unknown>).sensitivity_status === 'cleared' && (
                <div style={{ marginBottom:14, padding:'8px 12px', background:'rgba(34,197,94,0.08)', border:'1px solid #22C55E', borderRadius:8, fontSize:11, color:'#22C55E' }}>
                  ✅ Sensitiv-Flag manuell entfernt — Inhalt geprüft und freigegeben
                </div>
              )}
              <CoverImages entry={selected} onOpenLightbox={openLightbox}/>
              {(()=>{
                const snap = parseSnapshot(selected);
                const hasDiff = !!snap && isUpdated(selected);
                const sel = selected as Record<string,unknown>;
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {/* Medienvergleich — oben */}
                    {hasDiff&&<MediaDiffBlockExp entry={selected} snap={snap}/>}
                    {/* Hinweis-Banner */}
                    {hasDiff&&(
                      <div style={{ padding:'8px 12px', background:'#FFFBEA', borderLeft:'4px solid #FFB300', borderRadius:6, fontSize:11, color:'#9a6700', fontWeight:500 }}>
                        🔍 Gelb markierte Felder wurden geändert — hover für ALT/NEU-Vergleich.
                      </div>
                    )}
                    {/* Grid: alle Felder */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <DiffFieldExp label="Typ"             newVal={selected._source==='experiences'?'Erlebnis':'Projekt'} />
                      <DiffFieldExp label="Status (DB)"     newVal={str(selected.status)} />
                      <DiffFieldExp label="Freigabe-Status" newVal={normStatus(selected)} />
                      <DiffFieldExp label="Kategorie"       newVal={str(selected.category)}         oldVal={hasDiff?snap!.category:undefined} />
                      <DiffFieldExp label="Erlebnis-Typ"    newVal={str(sel.experience_type||'—')}  oldVal={hasDiff?snap!.experience_type:undefined} />
                      <DiffFieldExp label="Preis"           newVal={selected.price?`€${Number(selected.price).toLocaleString('de-DE')}`:'—'} oldVal={hasDiff?(snap!.price!=null?`€${Number(snap!.price).toLocaleString('de-DE')}`:'—'):undefined} />
                      <DiffFieldExp label="Datum"           newVal={str(sel.date||'—')}             oldVal={hasDiff?snap!.date:undefined} />
                      <DiffFieldExp label="Zeit"            newVal={sel.time_start?`${str(sel.time_start)} – ${str(sel.time_end)}`:'—'} oldVal={hasDiff?(snap!.time_start?`${str(snap!.time_start)} – ${str(snap!.time_end)}`:'—'):undefined} />
                      <DiffFieldExp label="Max. Teilnehmer" newVal={str(sel.max_participants||'—')} oldVal={hasDiff?snap!.max_participants:undefined} />
                      <DiffFieldExp label="Standort"        newVal={str(sel.location_text||'—')}    oldVal={hasDiff?snap!.location_text:undefined} />
                      <DiffFieldExp label="Erstellt"        newVal={timeAgo(selected.created_at)} />
                      <DiffFieldExp label="Eingereicht"     newVal={timeAgo(str(selected.last_submitted_at))} />
                      <DiffFieldExp label="User-ID"         newVal={str(selected.user_id).slice(0,18)+'…'} />
                    </div>
                    {/* Volltextfelder */}
                    <DiffFieldExp label="Titel"        newVal={str(selected.title)}       oldVal={hasDiff?snap!.title:undefined} />
                    {bool(selected.description)&&(
                      <DiffFieldExp label="Beschreibung" newVal={str(selected.description)} oldVal={hasDiff?snap!.description:undefined} />
                    )}
                    {bool(sel.caption)&&(
                      <DiffFieldExp label="Kurztext" newVal={str(sel.caption)} oldVal={hasDiff?snap!.caption:undefined} />
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </Modal>

        {/* ── Reject Modal ── */}
        <Modal open={rejectTarget!==null}
          title={rejectTarget?`❌ Ablehnen: „${rejectTarget.title||'Kein Titel'}"`:''}
          onClose={()=>{setRejectTarget(null);setRejectReason('');}}
          footer={(
            <div style={{ display:'flex', gap:6 }}>
              <Button variant="ghost" onClick={()=>{setRejectTarget(null);setRejectReason('');} }>Abbrechen</Button>
              <Button variant="danger" onClick={handleRejectConfirm} disabled={rejectLoading||!rejectReason.trim()}>
                {rejectLoading?'…':'❌ Ablehnen'}
              </Button>
            </div>
          )}
        >
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.5 }}>Gib einen Ablehnungsgrund an. Der Nutzer kann den Eintrag dann überarbeiten.</div>
            <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Ablehnungsgrund …" rows={4}
              style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-primary)', fontSize:13, fontFamily:'var(--font-body)', resize:'vertical', outline:'none', boxSizing:'border-box' }}/>
            {!rejectReason.trim()&&<div style={{ fontSize:11, color:'var(--text-muted)' }}>⚠️ Pflichtfeld</div>}
          </div>
        </Modal>

        {/* ── Delete Confirm ── */}
        <ConfirmModal
          open={deleteTarget!==null}
          title="🗑 Eintrag löschen?"
          message={`„${deleteTarget?.title||'Kein Titel'}" wird gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel="Löschen"
          confirmVariant="danger"
          onClose={()=>setDeleteTarget(null)}
          onConfirm={()=>{if(deleteTarget)handleDelete(deleteTarget);}}
        />

      </div>
      {/* Lightbox — eine Komponente für Superadmin + Employee */}
      {lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </DashboardLayout>
  );
}
