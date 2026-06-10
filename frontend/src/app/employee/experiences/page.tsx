// frontend/src/app/employee/experiences/page.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';
import { useExperiencesAndProjects, HuiEntry } from '@/lib/hooks/useSupabase';

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
  if (r.is_update === true) return true;
  if (!entry.last_submitted_at || !entry.created_at) return false;
  return new Date(str(entry.last_submitted_at)).getTime() > new Date(entry.created_at).getTime() + 5000;
}

function normStatus(e: HuiEntry): string {
  if (e.approval_status) return str(e.approval_status);
  if (e.status === 'pending_review') return 'pending';
  if (e.status === 'published')      return 'approved';
  if (e.status === 'rejected')       return 'rejected';
  if (e.status === 'draft')          return 'draft';
  if (e.status === 'deleted')        return 'deleted';
  return str(e.status) || 'unknown';
}

const isPending   = (e: HuiEntry) => normStatus(e) === 'pending';
const isApproved  = (e: HuiEntry) => { const ns = normStatus(e); return ns === 'approved' || ns === 'published'; };
const isRejected  = (e: HuiEntry) => normStatus(e) === 'rejected';
const isDraft     = (e: HuiEntry) => normStatus(e) === 'draft';
const isDeleted   = (e: HuiEntry) => normStatus(e) === 'deleted';
const isSensitive = (e: HuiEntry) => !e.title || String(e.title).trim().length < 2;

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

function CoverImages({ entry }: { entry: HuiEntry }) {
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
          <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>
        </div>
      ))}
    </div>
  );
}

export default function EmployeeErlebnisseProjektePage() {
  const [tab,           setTab]          = useState<TabKey>('all');
  const [search,        setSearch]       = useState('');
  const [selected,      setSelected]     = useState<HuiEntry|null>(null);
  const [showDetail,    setShowDetail]   = useState(false);
  const [rejectTarget,  setRejectTarget] = useState<HuiEntry|null>(null);
  const [rejectReason,  setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading]= useState(false);
  const [deleteTarget,  setDeleteTarget] = useState<HuiEntry|null>(null);
  const [localDel,      setLocalDel]     = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading]= useState<string|null>(null);

  const { entries: all, loading, refetch } = useExperiencesAndProjects({ status:'all', limit:1000, refreshInterval:0 });
  const refetchAll = useCallback(() => refetch(), [refetch]);

  const counts = useMemo<Record<TabKey,number>>(() => ({
    all:       all.filter(e=>isApproved(e)).length,
    published: all.filter(e=>isApproved(e)).length,
    pending:   all.filter(e=>isPending(e)).length,
    rejected:  all.filter(e=>isRejected(e)).length,
    draft:     all.filter(e=>isDraft(e)).length,
    deleted:   all.filter(e=>isDeleted(e)).length,
    sensitive: all.filter(e=>isSensitive(e)).length,
  }), [all]);

  const rows = useMemo(() => {
    const visible = all.filter(e => !localDel.has(e.id));
    let base: HuiEntry[];
    if      (tab==='pending')   base = visible.filter(e=>isPending(e));
    else if (tab==='published') base = visible.filter(e=>isApproved(e));
    else if (tab==='rejected')  base = visible.filter(e=>isRejected(e));
    else if (tab==='draft')     base = visible.filter(e=>isDraft(e));
    else if (tab==='deleted')   base = visible.filter(e=>isDeleted(e));
    else if (tab==='sensitive') base = visible.filter(e=>isSensitive(e));
    else                        base = visible.filter(e=>isApproved(e));
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(e => [e.title,e.category,e.description].some(v=>(v||'').toLowerCase().includes(q)));
  }, [tab, search, all, localDel]);

  const handleApprove = async (e: HuiEntry) => {
    setActionLoading(e.id);
    const ok = await entryAction(e._source==='experiences'?'approve_experience':'approve_project', e.id);
    setActionLoading(null);
    if (ok) { showToast(`✅ Freigegeben: ${e.title||'Eintrag'}`, 'success'); refetchAll(); }
    else     showToast('Fehler beim Freigeben', 'error');
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) { showToast('Bitte Ablehnungsgrund angeben','error'); return; }
    setRejectLoading(true);
    const ok = await entryAction(rejectTarget._source==='experiences'?'reject_experience':'reject_project', rejectTarget.id, {reason});
    setRejectLoading(false);
    if (ok) { showToast(`❌ Abgelehnt: ${rejectTarget.title||'Eintrag'}`, 'info'); setRejectTarget(null); setRejectReason(''); refetchAll(); }
    else showToast('Fehler beim Ablehnen','error');
  };

  const handleDelete = async (e: HuiEntry) => {
    setLocalDel(p=>new Set([...p,e.id])); setDeleteTarget(null);
    const ok = await entryAction(e._source==='experiences'?'delete_experience':'delete_project', e.id);
    if (ok) { showToast('🗑 Gelöscht','info'); setTimeout(()=>setLocalDel(new Set()),3000); }
    else { showToast('Fehler','error'); setLocalDel(p=>{const s=new Set(p);s.delete(e.id);return s;}); }
  };

  const BANNERS: Partial<Record<TabKey,{bg:string;border:string;color:string;text:string}>> = {
    pending:   {bg:'rgba(245,158,11,0.08)',  border:'#F59E0B',    color:'#F59E0B',    text:'⏳ Diese Erlebnisse & Projekte warten auf Freigabe.'},
    rejected:  {bg:'rgba(255,107,107,0.06)', border:'var(--red)', color:'var(--red)', text:'❌ Abgelehnte Einträge. Nutzer können sie überarbeiten.'},
    deleted:   {bg:'rgba(255,107,107,0.06)', border:'var(--red)', color:'var(--red)', text:'🗑 Gelöschte Einträge.'},
    sensitive: {bg:'rgba(247,183,49,0.08)',  border:'var(--gold)',color:'var(--gold)',text:'⚠️ Einträge ohne Titel oder Pflichtfelder.'},
  };
  const banner = BANNERS[tab];

  return (
    <DashboardLayout title="Erlebnisse & Projekte">
      <div style={{ padding:'24px 28px', maxWidth:1400, margin:'0 auto' }}>

        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:22 }}>🌿</span>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>Erlebnisse &amp; Projekte</h1>
            <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'var(--accent-dim)', color:'var(--accent)', fontWeight:600 }}>
              {all.length.toLocaleString('de-DE')} gesamt
            </span>
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>Freigabe, Ablehnung und Moderation von Erlebnissen und Projekten</div>
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:22, flexWrap:'wrap' }}>
          <Kachel label="Erlebnisse"  value={all.filter(e=>e._source==='experiences').length} color="var(--accent)" />
          <Kachel label="Projekte"    value={all.filter(e=>e._source==='projects').length}    color="#9370DB"       />
          <Kachel label="Published"   value={counts.published}  color="var(--green)"      />
          <Kachel label="Eingereicht" value={counts.pending}    color="#F59E0B"           />
          <Kachel label="Abgelehnt"   value={counts.rejected}   color="var(--red)"        />
          <Kachel label="Gelöscht"    value={counts.deleted}    color="var(--text-muted)" />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:220 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:14 }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Titel, Kategorie, Beschreibung …"
              style={{ width:'100%', padding:'8px 10px 8px 32px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12, fontFamily:'var(--font-body)', outline:'none', boxSizing:'border-box' }}/>
          </div>
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
                        style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.12s' }}
                        onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-tertiary)'}
                        onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=''}
                      >
                        <td style={{ padding:'10px 12px', maxWidth:200 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>
                              {entry.title||<span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Kein Titel</span>}
                            </span>
                            {isUpdated(entry)&&<span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.15)', color:'#F59E0B', fontWeight:700 }}>↻ UPD</span>}
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
                            <button onClick={()=>setDeleteTarget(entry)} title="Löschen"
                              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-muted)', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)' }}>🗑</button>
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
              <Button variant="ghost" onClick={()=>setShowDetail(false)}>Schließen</Button>
              {isPending(selected)&&<Button variant="primary" onClick={()=>{handleApprove(selected);setShowDetail(false);}}>✅ Freigeben</Button>}
              {isPending(selected)&&<Button variant="danger"  onClick={()=>{setShowDetail(false);setRejectTarget(selected);setRejectReason('');}}>❌ Ablehnen</Button>}
              {isRejected(selected)&&<Button variant="primary" onClick={()=>{handleApprove(selected);setShowDetail(false);}}>✅ Trotzdem freigeben</Button>}
              {!isDeleted(selected)&&<Button variant="danger" onClick={()=>{setShowDetail(false);setDeleteTarget(selected);}}>🗑 Löschen</Button>}
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
              {isPending(selected)&&!isUpdated(selected)&&(
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
              <CoverImages entry={selected}/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {([
                  ['Typ',            selected._source==='experiences'?'Erlebnis':'Projekt'],
                  ['Status (DB)',     str(selected.status)],
                  ['Freigabe-Status', normStatus(selected)],
                  ['Kategorie',       str(selected.category)],
                  ['Preis',           selected.price?`€${Number(selected.price).toLocaleString('de-DE')}`:'—'],
                  ['Erstellt',        timeAgo(selected.created_at)],
                  ['Eingereicht',     timeAgo(str(selected.last_submitted_at))],
                  ['User-ID',         str(selected.user_id).slice(0,18)+'…'],
                ] as [string,string][]).map(([k,v])=>(
                  <div key={k} style={{ padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>{k}</div>
                    <div style={{ fontSize:12, color:'var(--text-primary)', fontWeight:500, wordBreak:'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>
              {bool(selected.description)&&(
                <div style={{ padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Beschreibung</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>{str(selected.description)}</div>
                </div>
              )}
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
    </DashboardLayout>
  );
}
