// frontend/src/components/views/WorksView.tsx
// ARCHITEKTUR-KERN: Diese Datei ist die Single Source of Truth für Werke & Content.
// Superadmin (/works) und Employee (/employee/works) nutzen exakt dieselbe Komponente.
// Änderungen hier gelten automatisch für BEIDE Rollen.
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';
import { useWorks } from '@/lib/hooks/useWorks';
import type { HuiWork } from '@/lib/hooks/useWorks';
import { ImageLightbox, ClickableImage } from '@/components/ui/ImageLightbox';
// api imports handled via useWorks hook

// ── Types ─────────────────────────────────────────────────────────────────
type WorkWithMeta = HuiWork & Record<string, unknown> & {
  _sensitive: { flagged: boolean; reasons: string[] };
};

type TabKey = 'all' | 'published' | 'pending' | 'rejected' | 'draft' | 'flagged' | 'deleted' | 'sensitive';

interface EditForm {
  title: string; description: string; caption: string; category: string;
  tags: string; price: string; status: string; visibility: string;
  allow_comments: boolean; allow_likes: boolean; allow_shares: boolean;
  for_sale: boolean; is_showcase_only: boolean; location_text: string;
}

// ── Sensitive detector ────────────────────────────────────────────────────
const SENSITIVE_KEYWORDS: { kw: string; cat: string }[] = [
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
  { kw:'weapon',      cat:'⚠️ Gewalt'  }, { kw:'pistole',     cat:'⚠️ Gewalt'  },
  { kw:'gewehr',      cat:'⚠️ Gewalt'  }, { kw:'messer',      cat:'⚠️ Gewalt'  },
  { kw:'knife',       cat:'⚠️ Gewalt'  }, { kw:'gun',         cat:'⚠️ Gewalt'  },
  { kw:'terror',      cat:'⚠️ Gewalt'  },
  // Rassismus / Extremismus
  { kw:'nazi',        cat:'🚫 Extremismus' }, { kw:'hitler',  cat:'🚫 Extremismus' },
  { kw:' ss ',        cat:'🚫 Extremismus' }, { kw:'jihad',   cat:'🚫 Extremismus' },
  { kw:'isis',        cat:'🚫 Extremismus' }, { kw:'taliban', cat:'🚫 Extremismus' },
  { kw:'ausländer raus', cat:'🚫 Hassrede' }, { kw:'antisemit', cat:'🚫 Hassrede' },
  // Drogen
  { kw:'kokain',      cat:'💊 Drogen'  }, { kw:'heroin',      cat:'💊 Drogen'  },
  { kw:'meth',        cat:'💊 Drogen'  }, { kw:'crystal',     cat:'💊 Drogen'  },
  { kw:'droge',       cat:'💊 Drogen'  }, { kw:'drug',        cat:'💊 Drogen'  },
  { kw:'cannabis',    cat:'💊 Drogen'  },
  // Selbstverletzung
  { kw:'suizid',      cat:'🆘 Selbstverletzung' }, { kw:'selbstmord', cat:'🆘 Selbstverletzung' },
  { kw:'ritzen',      cat:'🆘 Selbstverletzung' },
  // Illegal
  { kw:'geld waschen',cat:'🚨 Illegal' }, { kw:'money launder', cat:'🚨 Illegal' },
  { kw:'hack',        cat:'🚨 Illegal' }, { kw:'betrug',      cat:'🚨 Illegal' },
  { kw:'fraud',       cat:'🚨 Illegal' }, { kw:'scam',        cat:'🚨 Illegal' },
  { kw:'geldwäsche',  cat:'🚨 Illegal' }, { kw:'stolen',      cat:'🚨 Illegal' },
  { kw:'gestohlen',   cat:'🚨 Illegal' },
];
const HIGH_PRICE_THRESHOLD = 5000;

// ── DB-Keywords (aus Supabase, werden zur Laufzeit geladen) ──────────────
interface DbKeyword { keyword: string; category: string; severity: number; }
let _dbKeywords: DbKeyword[] = [];
let _dbLoaded = false;

async function loadDbKeywords(): Promise<DbKeyword[]> {
  if (_dbLoaded) return _dbKeywords;
  try {
    const res = await fetch('/api/sensitive-keywords', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json() as { keyword: string; category: string; severity: number }[];
      _dbKeywords = data.map(d => ({
        kw: d.keyword, keyword: d.keyword, category: d.category, severity: d.severity,
        cat: catLabel(d.category),
      })) as unknown as DbKeyword[];
      _dbLoaded = true;
    }
  } catch { /* graceful fallback auf hardcoded list */ }
  return _dbKeywords;
}

function catLabel(cat: string): string {
  const map: Record<string, string> = {
    sexual_text:      '🔞 Sexuell',    sexual_image:   '🔞 Sexuell (Bild)',
    violence_text:    '⚠️ Gewalt',     violence_image: '⚠️ Gewalt (Bild)',
    racism_hate:      '🚫 Hassrede',   extremism:      '🚫 Extremismus',
    discrimination:   '🚫 Diskriminierung', self_harm: '🆘 Selbstverletzung',
    drugs:            '💊 Drogen',     illegal_activity: '🚨 Illegal',
    dangerous_behavior: '⚡ Gefährlich', emojis:       '🚨 Symbol',
    toxic_slang:      '🚫 Toxisch',
  };
  return map[cat] || `⚠️ ${cat}`;
}

function detectSensitive(w: WorkWithMeta): { flagged: boolean; reasons: string[] } {
  // Wenn Admin bereits geprüft hat und status gesetzt → das übernehmen
  if (w.sensitivity_status === 'flagged' && w.sensitivity_reason) {
    return { flagged: true, reasons: [String(w.sensitivity_reason)] };
  }
  if (w.sensitivity_status === 'cleared') {
    return { flagged: false, reasons: [] };
  }

  const reasons: string[] = [];
  const text = [w.title||'', w.description||'', w.caption||'', ((w.tags as string[])||[]).join(' '), w.category||''].join(' ').toLowerCase();
  const seen = new Set<string>();

  // Hardcoded list (schnell, immer verfügbar)
  for (const { kw, cat } of SENSITIVE_KEYWORDS) {
    if (text.includes(kw) && !seen.has(cat)) {
      seen.add(cat);
      reasons.push(`${cat}: "${kw}"`);
    }
  }
  // DB-Keywords (wenn geladen)
  for (const d of _dbKeywords as unknown as { kw?: string; keyword?: string; cat?: string; category?: string }[]) {
    const kw = (d.kw || d.keyword || '').toLowerCase();
    const cat = d.cat || catLabel(d.category || '');
    if (kw && text.includes(kw) && !seen.has(cat)) {
      seen.add(cat);
      reasons.push(`${cat}: "${kw}"`);
    }
  }

  const price = (w.price as number) || 0;
  if (price > HIGH_PRICE_THRESHOLD) reasons.push(`💰 Hoher Preis: €${price.toLocaleString('de-DE')}`);
  if (!w.title || String(w.title).trim().length < 2) reasons.push('⚠️ Fehlender Titel');
  const imgs = parseImages(w.images as unknown);
  if (imgs.length === 0 && !w.cover_url) reasons.push('📷 Kein Bild');
  return { flagged: reasons.length > 0, reasons };
}

// ── Image parser ──────────────────────────────────────────────────────────
function parseImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => {
    try {
      if (typeof i === 'string' && i.startsWith('{')) return JSON.parse(i).url || '';
      if (typeof i === 'object' && i !== null) return (i as Record<string, string>).url || '';
      return String(i);
    } catch { return ''; }
  }).filter(Boolean);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30) return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}
function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString('de-DE'); }

// ── Diff-Helfer für Update-Vergleich ─────────────────────────────────────
function parseWorkSnapshot(w: WorkWithMeta): Record<string, unknown> | null {
  const raw = w.admin_comment as unknown;
  if (typeof raw !== 'string' || !raw.startsWith('__snapshot__:')) return null;
  try { return JSON.parse(raw.slice('__snapshot__:'.length)); }
  catch { return null; }
}
function wValStr(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return (v as unknown[]).join(', ') || '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function DiffFieldWork({ label, newVal, oldVal }: { label: string; newVal: unknown; oldVal?: unknown }) {
  const [hov, setHov] = useState(false);
  const changed = oldVal !== undefined && wValStr(newVal) !== wValStr(oldVal);
  const nStr = wValStr(newVal); const oStr = wValStr(oldVal);
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

function MediaDiffBlockWork({ w, snap }: { w: WorkWithMeta; snap: Record<string,unknown>|null }) {
  if (!snap) return null;
  const newImgs = parseImages(w.images as unknown);
  const oldImgs = parseImages(snap.images as unknown);
  const nc = (w.cover_url as string)||newImgs[0]||'';
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

function buildForm(w: WorkWithMeta): EditForm {
  return {
    title: String(w.title||''), description: String(w.description||''),
    caption: String(w.caption||''), category: String(w.category||''),
    tags: ((w.tags as string[])||[]).join(', '), price: String(w.price||0),
    status: String(w.status||'draft'), visibility: String(w.visibility||'public'),
    allow_comments: w.allow_comments !== false, allow_likes: w.allow_likes !== false,
    allow_shares: w.allow_shares !== false, for_sale: Boolean(w.for_sale),
    is_showcase_only: Boolean(w.is_showcase_only), location_text: String(w.location_text||''),
  };
}

// ── API call ──────────────────────────────────────────────────────────────
async function workAction(action: string, workId: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: workId, data }),
    });
    return res.ok;
  } catch { return false; }
}

// ── Components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'published')      return <Badge variant="success" dot>Published</Badge>;
  if (status === 'pending_review') return <Badge variant="warning" dot>⏳ Pending</Badge>;
  if (status === 'rejected')       return <Badge variant="danger"  dot>❌ Abgelehnt</Badge>;
  if (status === 'draft')          return <Badge variant="neutral" dot>Draft</Badge>;
  if (status === 'flagged')        return <Badge variant="danger"  dot>⚑ Gemeldet</Badge>;
  if (status === 'deleted')        return <Badge variant="neutral">🗑 Gelöscht</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function Skeleton() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i} style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ height:11, background:'var(--bg-tertiary)', borderRadius:4, animation:'pulse 2s ease-in-out infinite', width: i===0?'70%':'50%' }}/>
        </td>
      ))}
    </tr>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, counts }: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  counts: Record<TabKey, number>;
}) {
  const tabs: { key: TabKey; label: string; icon: string; danger?: boolean }[] = [
    { key: 'all',       label: 'Alle',           icon: '' },
    { key: 'pending',   label: 'Eingereicht',     icon: '⏳', danger: false },
    { key: 'published', label: 'Published',       icon: '●' },
    { key: 'rejected',  label: 'Abgelehnt',       icon: '✕', danger: true },
    { key: 'draft',     label: 'Draft',           icon: '' },
    { key: 'flagged',   label: 'Gemeldet',        icon: '⚑', danger: true },
    { key: 'deleted',   label: 'Gelöscht',        icon: '🗑' },
    { key: 'sensitive', label: 'Sensitiv',        icon: '⚠️', danger: true },
  ];
  return (
    <div style={{ display:'flex', gap:4, marginBottom:14, borderBottom:'1px solid var(--border)', paddingBottom:10, flexWrap:'wrap' }}>
      {tabs.map(({ key, label, icon, danger }) => {
        const active = tab === key;
        const cnt = counts[key];
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400,
              border: `1px solid ${active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : 'var(--border)'}`,
              background: active ? (key === 'pending' ? 'rgba(245,158,11,0.12)' : danger ? 'var(--red-dim)' : 'var(--accent-dim)') : 'var(--bg-secondary)',
              color: active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
            {label}
            {cnt > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700,
                background: active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--bg-tertiary)'),
                color: active ? '#fff' : (key === 'pending' || danger ? '#fff' : 'var(--text-secondary)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>{cnt}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export function WorksView({ role = 'superadmin' }: { role?: 'superadmin' | 'employee' }) {
  const [tab, setTab]               = useState<TabKey>('all');
  // DB-Keywords lazy laden
  useEffect(() => { loadDbKeywords(); }, []);
  // Rollencheck — Employee sieht keine Destruktiv-Aktionen
  const isSuperadmin = role === 'superadmin';
  // ── Lightbox State ──────────────────────────────────────────────────────────
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const openLightbox = (images: string[], index = 0) => { setLightboxImages(images); setLightboxIndex(index); };
  const closeLightbox = () => setLightboxImages([]);
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<WorkWithMeta | null>(null);
  const [editMode, setEditMode]     = useState(false);
  const [form, setForm]             = useState<EditForm | null>(null);
  const [saving, setSaving]         = useState(false);
  const [busy, setBusy]             = useState<Record<string, boolean>>({});
  const [confirm, setConfirm]       = useState<{ open:boolean; title:string; message:string; onConfirm:()=>void; loading:boolean }>({
    open:false, title:'', message:'', onConfirm:()=>{}, loading:false
  });

  // ── EINEN einzigen useWorks-Call — alle Werke, Client filtert ──────────────
  const SUBMITTED_WV = ['pending_review']; // einziger echter DB-Status für 'eingereicht'
  const { works: allWorksRaw, loading, refetch: refetchAllTabs } = useWorks({ limit: 1000, refreshInterval: 0 });

  // Annotate all works with sensitive flag
  const annotate = (list: HuiWork[]): WorkWithMeta[] =>
    list.map((w) => ({ ...w, _sensitive: detectSensitive({ ...w, _sensitive: { flagged: false, reasons: [] } } as WorkWithMeta) }));

  const annotatedAll = useMemo(() => annotate(allWorksRaw), [allWorksRaw]);

  // Client-seitige Gruppen (kein zusätzlicher API-Call nötig)
  const annotatedPending  = useMemo(() => annotatedAll.filter(w => w.status === 'pending_review'), [annotatedAll]);
  const annotatedPublished= useMemo(() => annotatedAll.filter(w => w.status === 'published'), [annotatedAll]);
  const annotatedRejected = useMemo(() => annotatedAll.filter(w => w.status === 'rejected'), [annotatedAll]);
  const annotatedDraft    = useMemo(() => annotatedAll.filter(w => w.status === 'draft'), [annotatedAll]);
  const annotatedFlagged  = useMemo(() => annotatedAll.filter(w => w.status === 'flagged'), [annotatedAll]);
  const annotatedDeleted  = useMemo(() => annotatedAll.filter(w => w.status === 'deleted'), [annotatedAll]);

  // Tab counts — alle basieren auf dem einen Datensatz
  const counts: Record<TabKey, number> = useMemo(() => ({
    all:       annotatedAll.filter(w => w.status !== 'deleted').length,
    published: annotatedPublished.length,
    pending:   annotatedPending.length,
    rejected:  annotatedRejected.length,
    draft:     annotatedDraft.length,
    flagged:   annotatedFlagged.length,
    deleted:   annotatedDeleted.length,
    sensitive: annotatedAll.filter(w => w._sensitive.flagged && w.status !== 'deleted').length,
  }), [annotatedAll, annotatedPublished, annotatedPending, annotatedRejected, annotatedDraft, annotatedFlagged, annotatedDeleted]);

  // Active list based on tab — rein client-seitig
  const activeList = useMemo(() => {
    let base: WorkWithMeta[] = [];
    if      (tab === 'deleted')   base = annotatedDeleted;
    else if (tab === 'flagged')   base = annotatedFlagged;
    else if (tab === 'sensitive') base = annotatedAll.filter(w => w._sensitive.flagged && w.status !== 'deleted');
    else if (tab === 'published') base = annotatedPublished;
    else if (tab === 'draft')     base = annotatedDraft;
    else if (tab === 'pending')   base = annotatedPending;
    else if (tab === 'rejected')  base = annotatedRejected;
    else base = annotatedAll.filter(w => w.status !== 'deleted'); // 'all'

    if (search) {
      const q = search.toLowerCase();
      base = base.filter(w =>
        (w.title||'').toLowerCase().includes(q) ||
        (w.category||'').toLowerCase().includes(q) ||
        (w.description||'').toLowerCase().includes(q)
      );
    }
    return base;
  }, [tab, annotatedAll, annotatedDeleted, annotatedFlagged, annotatedPublished, annotatedDraft, annotatedPending, annotatedRejected, search]);

  const setBusyFor = (id: string, v: boolean) => setBusy(p => ({ ...p, [id]: v }));

  const openDetail = (w: WorkWithMeta) => { setSelected(w); setForm(buildForm(w)); setEditMode(false); };

  // ── Save Edit ──────────────────────────────────────────────────────────
  const handleSaveEdit = useCallback(async () => {
    if (!selected || !form) return;
    setSaving(true);
    const ok = await workAction('update_work', selected.id, {
      ...form,
      price: parseFloat(form.price)||0,
      price_eur: parseFloat(form.price)||0,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setSaving(false);
    if (ok) { showToast('✅ Work gespeichert', 'success'); refetchAllTabs(); setEditMode(false); }
    else showToast('Speichern fehlgeschlagen', 'error');
  }, [selected, form, refetchAllTabs]);

  // ── Restore (deleted → draft) ──────────────────────────────────────────
  const handleRestore = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open:true, loading:false,
      title: '♻️ Werk wiederherstellen',
      message: `„${w.title||'Kein Titel'}" wird wiederhergestellt und sofort als "Published" in der App sichtbar.`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading:true }));
        const ok = await workAction('restore_work', w.id);
        setConfirm(p => ({ ...p, loading:false, open:false }));
        if (ok) { showToast('✅ Werk wiederhergestellt', 'success'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Hard Delete (permanent, irreversible) ──────────────────────────────
  const handleHardDelete = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open: true, loading: false,
      title: '⚠️ Endgültig löschen',
      message: `ACHTUNG: „${w.title || 'Kein Titel'}" wird DAUERHAFT aus der Datenbank gelöscht. Diese Aktion kann NICHT rückgängig gemacht werden!`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading: true }));
        const ok = await workAction('hard_delete_work', w.id);
        setConfirm(p => ({ ...p, loading: false, open: false }));
        if (ok) { showToast('Werk dauerhaft gelöscht', 'info'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Unflag (flagged → published) ───────────────────────────────────────
  const handleUnflag = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open:true, loading:false,
      title: '✅ Meldung auflösen',
      message: `„${w.title||'Kein Titel'}" wird von der Meldeliste entfernt und wieder öffentlich geschaltet.`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading:true }));
        const ok = await workAction('unflag_work', w.id);
        setConfirm(p => ({ ...p, loading:false, open:false }));
        if (ok) { showToast('✅ Meldung aufgelöst, Werk ist wieder live', 'success'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Flag ───────────────────────────────────────────────────────────────
  const handleFlag = useCallback(async (w: WorkWithMeta) => {
    setBusyFor(w.id, true);
    const ok = await workAction('flag_work', w.id, { status:'flagged' });
    setBusyFor(w.id, false);
    if (ok) { showToast('⚑ Werk gemeldet', 'info'); refetchAllTabs(); }
    else showToast('Fehler', 'error');
  }, [refetchAllTabs]);

  // ── Unpublish ──────────────────────────────────────────────────────────
  const handleUnpublish = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open:true, loading:false,
      title: '📤 Werk depublizieren',
      message: `„${w.title||'Kein Titel'}" wird auf Draft gesetzt und versteckt.`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading:true }));
        const ok = await workAction('unpublish_work', w.id);
        setConfirm(p => ({ ...p, loading:false, open:false }));
        if (ok) { showToast('Werk depubliziert', 'info'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open:true, loading:false,
      title: '🗑 Werk löschen',
      message: `„${w.title||'Kein Titel'}" wird als gelöscht markiert. Du kannst es später unter "Gelöscht" wiederherstellen.`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading:true }));
        const ok = await workAction('delete_work', w.id);
        setConfirm(p => ({ ...p, loading:false, open:false }));
        if (ok) { showToast('Werk gelöscht', 'info'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Approve (draft/flagged/pending → published) ──────────────────────
  const handleApprove = useCallback(async (w: WorkWithMeta) => {
    setBusyFor(w.id, true);
    const ok = await workAction('approve_work', w.id);
    setBusyFor(w.id, false);
    if (ok) { showToast('✅ Work freigegeben', 'success'); refetchAllTabs(); }
    else showToast('Fehler', 'error');
  }, [refetchAllTabs]);

  // ── Clear Sensitive Flag ──────────────────────────────────────────────
  const handleClearSensitive = useCallback(async (w: WorkWithMeta) => {
    setBusyFor(w.id, true);
    const ok = await workAction('clear_sensitive_work', w.id);
    setBusyFor(w.id, false);
    if (ok) {
      showToast('✅ Sensitiv-Flag entfernt', 'success');
      refetchAllTabs();
      setSelected(prev => prev ? { ...prev, sensitivity_status: 'cleared', _sensitive: { flagged: false, reasons: [] } } as WorkWithMeta : null);
    } else {
      showToast('Fehler beim Entfernen des Flags', 'error');
    }
  }, [refetchAllTabs]);

  // ── Reject (pending_review → rejected) ────────────────────────────────
  const [rejectModal, setRejectModal] = useState<{ open: boolean; work: WorkWithMeta | null; reason: string }>({
    open: false, work: null, reason: ''
  });

  const handleReject = useCallback((w: WorkWithMeta) => {
    setRejectModal({ open: true, work: w, reason: '' });
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    const w = rejectModal.work;
    if (!w) return;
    const reason = rejectModal.reason.trim() || 'Nicht genehmigt';
    setRejectModal(p => ({ ...p, open: false }));
    setBusyFor(w.id, true);
    const ok = await workAction('reject_work', w.id, { reason });
    setBusyFor(w.id, false);
    if (ok) { showToast('❌ Werk abgelehnt — Nutzer benachrichtigt', 'success'); refetchAllTabs(); }
    else showToast('Fehler', 'error');
  }, [rejectModal, refetchAllTabs]);

  // ── Styles ─────────────────────────────────────────────────────────────
  const fieldStyle: React.CSSProperties = {
    width:'100%', padding:'7px 10px', background:'var(--bg-tertiary)',
    border:'1px solid var(--border)', borderRadius:7, fontSize:12,
    color:'var(--text-primary)', fontFamily:'var(--font-body)', outline:'none',
  };

  // ── Tab context messages ────────────────────────────────────────────────
  const tabBanners: Partial<Record<TabKey, { bg: string; border: string; color: string; text: string }>> = {
    pending:   { bg:'rgba(234,179,8,0.06)',   border:'var(--gold)', color:'var(--gold)', text:'⏳ Diese Werke warten auf Freigabe. Prüfe sie und klicke auf ✅ Freigeben oder ❌ Ablehnen.' },
    rejected:  { bg:'rgba(255,107,107,0.06)', border:'var(--red)',  color:'var(--red)',  text:'❌ Abgelehnte Werke. Nutzer können sie überarbeiten und erneut einreichen.' },
    deleted:   { bg:'rgba(255,107,107,0.06)', border:'var(--red)',  color:'var(--red)',  text:'🗑 Hier siehst du gelöschte Werke. Du kannst sie als Draft wiederherstellen.' },
    flagged:   { bg:'rgba(247,183,49,0.08)', border:'var(--gold)', color:'var(--gold)', text:'⚑ Gemeldete Werke sind versteckt. Du kannst die Meldung auflösen oder das Werk endgültig löschen.' },
    sensitive: { bg:'rgba(255,107,107,0.06)', border:'var(--red)',  color:'var(--red)',  text:'⚠️ Werke mit verdächtigen Keywords, hohen Preisen oder fehlenden Bildern. Prüfe jeden Eintrag.' },
  };

  const banner = tabBanners[tab];

  return (
    <DashboardLayout
      title="Werke & Content"
      headerActions={
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {counts.pending > 0 && (
            <button onClick={() => setTab('pending')} style={{ fontSize:11, background:'rgba(245,158,11,0.12)', color:'#F59E0B', padding:'3px 10px', borderRadius:20, border:'1px solid #F59E0B', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              ⏳ {counts.pending} eingereicht
            </button>
          )}
          {counts.flagged > 0 && (
            <button onClick={() => setTab('flagged')} style={{ fontSize:11, background:'var(--red-dim)', color:'var(--red)', padding:'3px 10px', borderRadius:20, border:'1px solid var(--red)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              ⚑ {counts.flagged} gemeldet
            </button>
          )}
          {counts.sensitive > 0 && (
            <button onClick={() => setTab('sensitive')} style={{ fontSize:11, background:'var(--gold-dim)', color:'var(--gold)', padding:'3px 10px', borderRadius:20, border:'1px solid var(--gold)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              ⚠️ {counts.sensitive} sensitiv
            </button>
          )}
          <span style={{ fontSize:11, color:'var(--green)', background:'rgba(81,207,102,0.1)', padding:'3px 10px', borderRadius:20, border:'1px solid rgba(81,207,102,0.2)' }}>● Live</span>
          <button onClick={refetchAllTabs} style={{ padding:'5px 10px', background:'var(--bg-tertiary)', border:'1px solid var(--border)', borderRadius:8, fontSize:11, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:16 }} className="grid-6">
        {[
          { label:'Werke gesamt',   value: loading ? '…' : fmt(counts.published + counts.draft), color:'var(--accent)' },
          { label:'Published',      value: loading ? '…' : fmt(counts.published),               color:'var(--green)'  },
          { label:'Draft',          value: loading ? '…' : fmt(counts.draft),                   color:'var(--gold)'   },
          { label:'Eingereicht',    value: loading ? '…' : fmt(counts.pending),                 color:'#F59E0B'       },
          { label:'Gemeldet',       value: loading ? '…' : fmt(counts.flagged),                 color:'var(--red)'    },
          { label:'Gelöscht',       value: loading ? '…' : fmt(counts.deleted),                 color:'var(--text-muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:22, fontWeight:700, color, fontFamily:'var(--font-mono)' }}>{value}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginTop:3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <TabBar tab={tab} setTab={setTab} counts={counts} />

      {/* Context Banner */}
      {banner && (
        <div style={{ marginBottom:12, padding:'10px 14px', background:banner.bg, border:`1px solid ${banner.border}`, borderRadius:8, fontSize:12, color:banner.color }}>
          {banner.text}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom:12, position:'relative' }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:12 }}>🔍</span>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={`In ${tab === 'deleted' ? 'gelöschten' : tab === 'flagged' ? 'gemeldeten' : 'allen'} Werken suchen…`}
          style={{ ...fieldStyle, paddingLeft:30, boxSizing:'border-box' }}
        />
      </div>

      {/* Count hint */}
      <div style={{ marginBottom:8, fontSize:11, color:'var(--text-muted)' }}>
        {loading ? 'Lädt…' : `${activeList.length} Einträge`}
        {tab === 'deleted'   && counts.deleted   > 0 && ' · Klicke auf ein Werk, um es wiederherzustellen'}
        {tab === 'flagged'   && counts.flagged   > 0 && ' · Klicke auf ein Werk, um die Meldung zu verwalten'}
        {tab === 'sensitive' && counts.sensitive > 0 && ' · Klicke auf ein Werk, um den Inhalt zu prüfen'}
      </div>

      {/* Table */}
      <div style={{ background:'var(--bg-secondary)', border:`1px solid ${tab==='deleted'?'rgba(255,107,107,0.2)':tab==='flagged'?'rgba(247,183,49,0.2)':'var(--border)'}`, borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background: tab==='deleted' ? 'rgba(255,107,107,0.04)' : tab==='flagged' ? 'rgba(247,183,49,0.04)' : undefined }}>
                {['', 'Titel', 'Kategorie', 'Status', 'Preis', 'Engagement', 'Erstellt', 'Aktionen'].map(h => (
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:600, letterSpacing:'0.7px', textTransform:'uppercase', color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton/><Skeleton/><Skeleton/><Skeleton/></>
              ) : activeList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding:48, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
                    {tab === 'deleted'   ? '🗑 Keine gelöschten Werke' :
                     tab === 'flagged'   ? '✅ Keine gemeldeten Werke' :
                     tab === 'sensitive' ? '✅ Kein sensitiver Inhalt gefunden' :
                     'Keine Werke gefunden'}
                  </td>
                </tr>
              ) : activeList.map((w) => {
                const imgs = parseImages(w.images as unknown);
                const cover = (w.cover_url as string) || imgs[0] || '';
                const isBusy = busy[w.id];
                const price = (w.price as number) || 0;

                return (
                  <tr key={w.id} className="tr-hover"
                    style={{ background: w._sensitive.flagged && tab !== 'deleted' ? 'rgba(255,107,107,0.02)' : undefined }}
                    onClick={() => openDetail(w)}
                  >
                    {/* Thumbnail */}
                    <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)', width:44 }}>
                      <div style={{ width:36, height:36, borderRadius:8, overflow:'hidden', background:'var(--bg-tertiary)', position:'relative' }}>
                        {cover
                          ? <img src={cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.currentTarget.style.display='none'; }}/>
                          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🎨</div>
                        }
                        {tab === 'deleted' && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🗑</div>}
                      </div>
                    </td>
                    {/* Title */}
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', maxWidth:200 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        {w._sensitive.flagged && tab !== 'deleted' && <span title={w._sensitive.reasons.join('\n')} style={{ color:'var(--red)', fontSize:12, cursor:'help' }}>⚠️</span>}
                        <div>
                          <div style={{ color:'var(--text-primary)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:170, textDecoration: w.status === 'deleted' ? 'line-through' : 'none', opacity: w.status === 'deleted' ? 0.6 : 1 }}>
                            {w.title || <span style={{ color:'var(--text-muted)' }}>—</span>}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                            <span style={{ color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-mono)' }}>{String(w.id).slice(0,8)}…</span>
                            {tab === 'pending' && (
                              Boolean((w as Record<string,unknown>).is_update)
                                ? <span style={{ padding:'1px 5px', borderRadius:4, fontSize:8, fontWeight:700, background:'rgba(168,139,250,0.18)', color:'#A78BFA' }}>UPDATE</span>
                                : <span style={{ padding:'1px 5px', borderRadius:4, fontSize:8, fontWeight:700, background:'rgba(42,191,172,0.18)', color:'#2ABFAC' }}>NEU</span>
                            )}
                            {tab === 'pending' && Boolean((w as Record<string,unknown>).last_submitted_at) && (
                              <span style={{ fontSize:9, color:'var(--text-muted)' }}>
                                {timeAgo(String((w as Record<string,unknown>).last_submitted_at ?? ''))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{w.category||'—'}</td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)' }}><StatusBadge status={String(w.status||'draft')}/></td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-mono)', fontSize:11, color: price>HIGH_PRICE_THRESHOLD ? 'var(--red)' : price>0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                      {price > 0 ? `€${price.toLocaleString('de-DE')}` : '—'}
                    </td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', fontSize:11, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                      <span title="Likes">❤ {w.likes_count||0}</span>
                      <span style={{ marginLeft:6 }} title="Views">👁 {w.views_count||0}</span>
                      <span style={{ marginLeft:6 }} title="Kommentare">💬 {w.comments_count||0}</span>
                    </td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', color:'var(--text-muted)', fontSize:11, whiteSpace:'nowrap' }}>{timeAgo(String(w.created_at||''))}</td>
                    {/* Row Actions — context-aware */}
                    <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:3 }}>
                        <button title="Details" onClick={() => openDetail(w)}
                          style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--accent)', cursor:'pointer', fontSize:12 }}>👁</button>

                        {/* DELETED tab: Restore + Hard Delete */}
                        {tab === 'deleted' && (
                          <>
                            <button title="Wiederherstellen" disabled={isBusy} onClick={() => handleRestore(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                              {isBusy ? '…' : '♻️ Restore'}
                            </button>
                            {isSuperadmin && <button title="Endgültig löschen" disabled={isBusy} onClick={() => handleHardDelete(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              {isBusy ? '…' : '🗑 Löschen'}
                            </button>}
                          </>
                        )}

                        {/* FLAGGED tab: Unflag + Delete */}
                        {tab === 'flagged' && (
                          <>
                            <button title="Meldung auflösen" disabled={isBusy} onClick={() => handleUnflag(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                              {isBusy ? '…' : '✅ Auflösen'}
                            </button>
                            {isSuperadmin && <button title="Löschen" disabled={isBusy} onClick={() => handleDelete(w)}
                              style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:12 }}>🗑</button>}
                          </>
                        )}

                        {/* PENDING tab: Freigeben + Ablehnen */}
                        {(tab as string) === 'pending' && (
                          <>
                            <button title="Freigeben" disabled={isBusy} onClick={() => handleApprove(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              {isBusy ? '…' : '✅ Freigeben'}
                            </button>
                            <button title="Ablehnen" disabled={isBusy} onClick={() => handleReject(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              {isBusy ? '…' : '❌ Ablehnen'}
                            </button>
                          </>
                        )}

                        {/* REJECTED tab: Wieder freigeben + Löschen */}
                        {(tab as string) === 'rejected' && (
                          <>
                            <button title="Doch freigeben" disabled={isBusy} onClick={() => handleApprove(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              {isBusy ? '…' : '✅ Freigeben'}
                            </button>
                            {isSuperadmin && (
                              <button title="Werk endgültig löschen (Hard-Delete)" disabled={isBusy} onClick={() => handleHardDelete(w)}
                                style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:11, fontWeight:700, marginLeft:4 }}>
                                {isBusy ? '…' : '🗑 Löschen'}
                              </button>
                            )}
                          </>
                        )}

                        {/* ALL / PUBLISHED / DRAFT / SENSITIVE tabs */}
                        {tab !== 'deleted' && tab !== 'flagged' && (tab as string) !== 'pending' && (tab as string) !== 'rejected' && (
                          <>
                            {w.status === 'draft' && (
                              <button title="Freigeben" disabled={isBusy} onClick={() => handleApprove(w)}
                                style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:12 }}>✓</button>
                            )}
                            {w.status === 'published' && isSuperadmin && (
                              <button title="Melden" disabled={isBusy} onClick={() => handleFlag(w)}
                                style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--gold)', background:'var(--gold-dim)', color:'var(--gold)', cursor:'pointer', fontSize:12 }}>⚑</button>
                            )}
                            {isSuperadmin && <button title="Löschen" disabled={isBusy} onClick={() => handleDelete(w)}
                              style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:12 }}>🗑</button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail / Edit Modal ─────────────────────────────────────────── */}
      {selected && (
        <Modal
          open
          onClose={() => { setSelected(null); setEditMode(false); }}
          title={editMode ? `✏️ Bearbeiten: ${selected.title||'Kein Titel'}` : `📄 Werk Details`}
          width={700}
          footer={
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Button variant="ghost" onClick={() => { setSelected(null); setEditMode(false); }}>Schließen</Button>
              {!editMode ? (
                <>
                  <Button variant="primary" onClick={() => setEditMode(true)}>✏️ Bearbeiten</Button>

                  {/* Status-specific actions */}
                  {selected.status === 'deleted' && (
                    <>
                      <Button variant="primary" onClick={() => handleRestore(selected)}>♻️ Wiederherstellen</Button>
                      {isSuperadmin && <Button variant="danger" onClick={() => handleHardDelete(selected)}>🗑 Endgültig löschen</Button>}
                    </>
                  )}
                  {selected.status === 'flagged' && (
                    <>
                      <Button variant="primary" onClick={() => handleUnflag(selected)}>✅ Meldung auflösen</Button>
                      {isSuperadmin && <Button variant="danger"  onClick={() => handleDelete(selected)}>🗑 Löschen</Button>}
                    </>
                  )}
                  {selected.status === 'published' && (
                    <>
                      {isSuperadmin && <Button variant="ghost"  onClick={() => handleUnpublish(selected)}>📤 Depublizieren</Button>}
                      {isSuperadmin && <Button variant="danger" onClick={() => handleFlag(selected)}>⚑ Melden</Button>}
                      {isSuperadmin && <Button variant="danger" onClick={() => handleDelete(selected)}>🗑 Löschen</Button>}
                    </>
                  )}
                  {selected.status === 'draft' && (
                    <>
                      <Button variant="primary" onClick={() => handleApprove(selected)}>✅ Freigeben</Button>
                      {isSuperadmin && <Button variant="danger"  onClick={() => handleDelete(selected)}>🗑 Löschen</Button>}
                    </>
                  )}
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setEditMode(false)}>Abbrechen</Button>
                  <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>{saving ? '…' : '💾 Speichern'}</Button>
                </>
              )}
            </div>
          }
        >
          {/* Sensitive alert + Clear-Button */}
          {(selected as any)._sensitive?.flagged && (
            <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(255,107,107,0.08)', border:'1px solid var(--red)', borderRadius:8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--red)' }}>⚠️ Sensitiver Inhalt erkannt</div>
                <button
                  onClick={() => handleClearSensitive(selected)}
                  style={{
                    fontSize:11, padding:'3px 10px', borderRadius:20,
                    background:'rgba(34,197,94,0.1)', color:'#22C55E',
                    border:'1px solid #22C55E', cursor:'pointer',
                    fontWeight:600, fontFamily:'var(--font-body)'
                  }}
                  title="Flag entfernen — Inhalt wurde geprüft und ist unbedenklich"
                >
                  ✅ Flag entfernen
                </button>
              </div>
              {((selected as any)._sensitive.reasons as string[]).map((r: string, i: number) => (
                <div key={i} style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>• {r}</div>
              ))}
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>
                Nach dem Entfernen wird der Eintrag nicht mehr im Sensitiv-Tab angezeigt.
              </div>
            </div>
          )}
          {(selected as any).sensitivity_status === 'cleared' && (
            <div style={{ marginBottom:14, padding:'8px 12px', background:'rgba(34,197,94,0.08)', border:'1px solid #22C55E', borderRadius:8, fontSize:11, color:'#22C55E' }}>
              ✅ Sensitiv-Flag manuell entfernt — Inhalt geprüft und freigegeben
            </div>
          )}

          {/* Status banner in modal */}
          {selected.status === 'deleted' && (
            <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(255,107,107,0.07)', border:'1px solid var(--red)', borderRadius:8, fontSize:12, color:'var(--red)' }}>
              🗑 Dieses Werk ist als gelöscht markiert und in der App <strong>nicht sichtbar</strong>.
              <br/><span style={{ marginTop:4, display:'block', opacity:0.8 }}>♻️ Wiederherstellen → setzt es als Draft zurück · 🗑 Endgültig löschen → unwiderruflich aus der Datenbank entfernen</span>
            </div>
          )}
          {selected.status === 'flagged' && (
            <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--gold-dim)', border:'1px solid var(--gold)', borderRadius:8, fontSize:12, color:'var(--gold)' }}>
              ⚑ Dieses Werk ist gemeldet und für User versteckt. Prüfe den Inhalt und löse die Meldung auf oder lösche das Werk.
            </div>
          )}

          {/* Media */}
          {(() => {
            const imgs = parseImages(selected.images as unknown);
            const cover = (selected.cover_url as string) || imgs[0];
            const all = cover ? [cover, ...imgs.filter(u => u !== cover)] : imgs;
            return all.length > 0 ? (
              <div style={{ display:'flex', gap:6, marginBottom:14, overflowX:'auto', paddingBottom:4 }}>
                {all.slice(0,6).map((url, i) => (
                  <div key={i} style={{ flexShrink:0, width:i===0?180:80, height:i===0?120:80, borderRadius:8, overflow:'hidden', background:'var(--bg-tertiary)', border:`${i===0?2:1}px solid ${i===0?'var(--accent)':'var(--border)'}` }}>
                    <ClickableImage
                      src={url} alt=""
                      style={{ width:'100%', height:'100%', objectFit:'cover' }}
                      containerStyle={{ width:'100%', height:'100%' }}
                      onOpenLightbox={() => openLightbox(all, i)}
                      onError={e => { e.currentTarget.style.display='none'; }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height:70, background:'var(--bg-tertiary)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:12, marginBottom:14, border:'1px solid var(--border)' }}>📷 Kein Bild</div>
            );
          })()}

          {!editMode ? (() => {
            const wSnap = parseWorkSnapshot(selected);
            const wHasDiff = !!wSnap && Boolean(selected.is_update);
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {wHasDiff&&<MediaDiffBlockWork w={selected} snap={wSnap}/>}
                {wHasDiff&&(
                  <div style={{ padding:'8px 12px', background:'#FFFBEA', borderLeft:'4px solid #FFB300', borderRadius:6, fontSize:11, color:'#9a6700', fontWeight:500 }}>
                    🔍 Gelb markierte Felder wurden geändert — hover für ALT/NEU-Vergleich.
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <DiffFieldWork label="ID"           newVal={String(selected.id)} />
                  <DiffFieldWork label="Titel"        newVal={String(selected.title||'—')}       oldVal={wHasDiff?wSnap!.title:undefined} />
                  <DiffFieldWork label="Status"       newVal={String(selected.status||'—')} />
                  <DiffFieldWork label="Sichtbarkeit" newVal={String(selected.visibility||'—')}  oldVal={wHasDiff?wSnap!.visibility:undefined} />
                  <DiffFieldWork label="Kategorie"    newVal={String(selected.category||'—')}    oldVal={wHasDiff?wSnap!.category:undefined} />
                  <DiffFieldWork label="Post-Typ"     newVal={String(selected.post_type||'—')} />
                  <DiffFieldWork label="Preis"        newVal={`€${((selected.price as number)||0).toLocaleString('de-DE')}`} oldVal={wHasDiff?(wSnap!.price!=null?`€${Number(wSnap!.price).toLocaleString('de-DE')}`:'—'):undefined} />
                  <DiffFieldWork label="Für Verkauf"  newVal={Boolean(selected.for_sale)?'Ja':'Nein'} oldVal={wHasDiff?wSnap!.for_sale:undefined} />
                  <DiffFieldWork label="Lagerbestand" newVal={String(selected.stock_quantity??'—')} />
                  <DiffFieldWork label="Kommentare"   newVal={Boolean(selected.allow_comments)?'✅ erlaubt':'🚫 gesperrt'} />
                  <DiffFieldWork label="Likes"        newVal={Boolean(selected.allow_likes)?'✅ erlaubt':'🚫 gesperrt'} />
                  <DiffFieldWork label="Standort"     newVal={String(selected.location_text||'—')} oldVal={wHasDiff?wSnap!.location_text:undefined} />
                  <DiffFieldWork label="Views"        newVal={String(selected.views_count||0)} />
                  <DiffFieldWork label="Likes #"      newVal={String(selected.likes_count||0)} />
                  <DiffFieldWork label="Kommentare #" newVal={String(selected.comments_count||0)} />
                  <DiffFieldWork label="Erstellt"     newVal={timeAgo(String(selected.created_at||''))} />
                  <DiffFieldWork label="User-ID"      newVal={String(selected.user_id||'—').slice(0,18)+'…'} />
                  {selected.description&&(
                    <div style={{ gridColumn:'1/-1' }}>
                      <DiffFieldWork label="Beschreibung" newVal={String(selected.description)} oldVal={wHasDiff?wSnap!.description:undefined}/>
                    </div>
                  )}
                  {selected.caption&&(
                    <div style={{ gridColumn:'1/-1' }}>
                      <DiffFieldWork label="Caption" newVal={String(selected.caption)} oldVal={wHasDiff?wSnap!.caption:undefined}/>
                    </div>
                  )}
                  {Array.isArray(selected.tags)&&(selected.tags as string[]).length>0&&(
                    <div style={{ gridColumn:'1/-1', padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Tags</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {(selected.tags as string[]).map(t=>(
                          <span key={t} style={{ padding:'2px 8px', borderRadius:20, background:'var(--accent-dim)', color:'var(--accent)', fontSize:11 }}>#{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : form ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Titel</label>
                  <input style={fieldStyle} value={form.title} onChange={e => setForm({...form, title:e.target.value})}/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Kategorie</label>
                  <select style={fieldStyle} value={form.category} onChange={e => setForm({...form, category:e.target.value})}>
                    {['Sonstiges','Musik','Design','Digitale Kunst','Fotografie','Video','Dienstleistung','Handwerk','Mode','Essen & Trinken'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Status</label>
                  <select style={fieldStyle} value={form.status} onChange={e => setForm({...form, status:e.target.value})}>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="flagged">Gemeldet</option>
                    <option value="deleted">Gelöscht</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Sichtbarkeit</label>
                  <select style={fieldStyle} value={form.visibility} onChange={e => setForm({...form, visibility:e.target.value})}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Preis (€)</label>
                  <input style={fieldStyle} type="number" min="0" value={form.price} onChange={e => setForm({...form, price:e.target.value})}/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Standort</label>
                  <input style={fieldStyle} value={form.location_text} onChange={e => setForm({...form, location_text:e.target.value})}/>
                </div>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Beschreibung</label>
                <textarea style={{...fieldStyle, height:70, resize:'vertical'}} value={form.description} onChange={e => setForm({...form, description:e.target.value})}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Caption</label>
                <textarea style={{...fieldStyle, height:50, resize:'vertical'}} value={form.caption} onChange={e => setForm({...form, caption:e.target.value})}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Tags (kommagetrennt)</label>
                <input style={fieldStyle} value={form.tags} onChange={e => setForm({...form, tags:e.target.value})} placeholder="tag1, tag2, tag3"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {([['allow_comments','Kommentare'],['allow_likes','Likes'],['allow_shares','Shares'],['for_sale','Zum Verkauf'],['is_showcase_only','Nur Showcase']] as [keyof EditForm, string][]).map(([k, lbl]) => (
                  <label key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)', cursor:'pointer', padding:'6px 8px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                    <input type="checkbox" checked={Boolean(form[k])} onChange={e => setForm({...form, [k]:e.target.checked})}/>
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </Modal>
      )}

      <ConfirmModal
        open={confirm.open}
        onClose={() => setConfirm(p => ({...p, open:false}))}
        onConfirm={confirm.onConfirm}
        title={confirm.title}
        message={confirm.message}
        loading={confirm.loading}
        confirmLabel="Bestätigen"
        confirmVariant="danger"
      />

      {/* ── Ablehnen-Modal ───────────────────────────────────────── */}
      {rejectModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-secondary)', border:'1px solid rgba(255,107,107,0.35)',
            borderRadius:14, padding:28, width:460, maxWidth:'94vw', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:6, color:'var(--red)' }}>
              ❌ Werk ablehnen
            </div>
            <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16 }}>
              <strong style={{color:'var(--text-primary)'}}>„{rejectModal.work?.title || 'Dieses Werk'}"</strong> wird unsichtbar gesetzt.
              Der Nutzer erhält sofort eine Benachrichtigung mit dem Ablehnungsgrund.
            </div>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6 }}>
              Ablehnungsgrund *
            </label>
            <textarea
              autoFocus
              value={rejectModal.reason}
              onChange={e => setRejectModal(p => ({ ...p, reason: e.target.value }))}
              placeholder="z.B. Bild-Qualität nicht ausreichend, Beschreibung fehlt, oder Inhalte entsprechen nicht den HUI-Richtlinien…"
              rows={4}
              style={{ width:'100%', padding:'9px 12px', background:'var(--bg-tertiary)',
                border:'1px solid var(--border)', borderRadius:9, fontSize:13, color:'var(--text-primary)',
                fontFamily:'var(--font-body)', resize:'vertical', boxSizing:'border-box',
                outline:'none', lineHeight:1.5 }}
            />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button onClick={() => setRejectModal({ open:false, work:null, reason:'' })}
                style={{ padding:'8px 18px', borderRadius:8, border:'1px solid var(--border)',
                  background:'var(--bg-tertiary)', color:'var(--text-secondary)', cursor:'pointer',
                  fontSize:13, fontFamily:'var(--font-body)' }}>
                Abbrechen
              </button>
              <button onClick={handleRejectConfirm}
                style={{ padding:'8px 18px', borderRadius:8, border:'none',
                  background:'var(--red)', color:'#fff', cursor:'pointer',
                  fontSize:13, fontWeight:700, fontFamily:'var(--font-body)',
                  opacity: rejectModal.reason.trim() ? 1 : 0.6 }}>
                ❌ Ablehnen &amp; Nutzer benachrichtigen
              </button>
            </div>
          </div>
        </div>
      )}
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
// deploy-trigger: 2026-06-09
