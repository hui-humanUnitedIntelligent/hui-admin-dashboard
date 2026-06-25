// frontend/src/app/employee/works/page.tsx
// Employee: Werke — volle Content-Rechte (approve/reject/flag/sensitiv/publish/edit/delete)
// KEIN Hard-Delete · KEIN Admin-Layout · Nur /api/employee/*
'use client';
import { useState, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useWorks } from '@/lib/hooks/useSupabase';
import { getSessionToken } from '@/lib/session';

type TabKey = 'pending' | 'published' | 'rejected' | 'flagged' | 'deleted' | 'all';

const STATUS_VARIANT: Record<string, 'success'|'warning'|'danger'|'neutral'|'info'> = {
  published:'success', draft:'warning', rejected:'danger', flagged:'info', deleted:'neutral', pending:'warning',
};
function fmtPrice(n:number|null|undefined){if(!n)return'—';return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);}
function timeAgo(iso:string|null|undefined){if(!iso)return'—';const d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);if(d===0)return'Heute';if(d<7)return`${d}d`;if(d<30)return`${Math.floor(d/7)}w`;return`${Math.floor(d/30)}mo`;}

interface RejectModal { id: string; title: string; }

export default function EmployeeWorksPage() {
  const { works, loading, refetch } = useWorks({ limit: 500 });
  const [tab,     setTab]     = useState<TabKey>('pending');
  const [search,  setSearch]  = useState('');
  const [busy,    setBusy]    = useState<string|null>(null);
  const [toast,   setToast]   = useState('');
  const [rejectModal, setRejectModal] = useState<RejectModal|null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(()=>setToast(''), 3000); }, []);

  async function call(action: string, id: string, data?: Record<string,unknown>) {
    setBusy(id);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/employee/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, id, data }),
      });
      if (res.ok) { refetch(); return true; }
      else { showToast('Fehler: ' + (await res.json()).error); return false; }
    } catch { showToast('Netzwerkfehler'); return false; }
    finally { setBusy(null); }
  }

  async function softDelete(id: string, title: string) {
    if (!confirm(`„${title}" löschen? Superadmin wird benachrichtigt.`)) return;
    const ok = await call('soft_delete_work', id);
    if (ok) {
      setDeletedIds(p => new Set([...p, id]));
      showToast('Gelöscht — Superadmin wird informiert');
      refetch();
    }
  }

  const SUBMITTED = ['pending_review']; // einziger echter DB-Status
  const counts: Record<TabKey, number> = {
    pending:   works.filter(w=>SUBMITTED.includes(w.status||'')||SUBMITTED.includes(w.approval_status||'')).length,
    published: works.filter(w=>w.status==='published'||w.approval_status==='approved').length,
    rejected:  works.filter(w=>w.status==='rejected'||w.approval_status==='rejected').length,
    flagged:   works.filter(w=>w.status==='flagged').length,
    deleted:   works.filter(w=>w.status==='deleted').length,
    all:       works.length,
  };

  const filtered = works.filter(w => {
    if (tab==='pending')   return SUBMITTED.includes(w.status||'')||SUBMITTED.includes(w.approval_status||'');
    if (tab==='published') return w.status==='published'||w.approval_status==='approved';
    if (tab==='rejected')  return w.status==='rejected'||w.approval_status==='rejected';
    if (tab==='flagged')   return w.status==='flagged';
    if (tab==='deleted')   return w.status==='deleted';
    return true;
  }).filter(w => {
    const q = search.toLowerCase();
    return !q||(w.title||'').toLowerCase().includes(q)||(w.category||'').toLowerCase().includes(q);
  });

  const tabBtn = (t: TabKey, label: string, count: number, color?: string) => (
    <button onClick={()=>setTab(t)} style={{
      padding:'5px 14px', borderRadius:20, border:`1px solid ${tab===t?(color||'var(--accent)'):'var(--border)'}`,
      background: tab===t ? (color||'var(--accent)') : 'transparent',
      color: tab===t ? (color?'#fff':'#0f1117') : 'var(--text-muted)',
      fontWeight:700, fontSize:11, cursor:'pointer', display:'flex', gap:5, alignItems:'center',
    }}>
      {label}
      {count>0&&<span style={{background:'rgba(255,255,255,0.25)',borderRadius:99,padding:'0 5px',fontSize:10,minWidth:16,textAlign:'center'}}>{count}</span>}
    </button>
  );

  return (
    <EmployeeLayout title="Werke & Content">
      <PageHeader title="Werke & Content" subtitle="Volle Content-Rechte · Realtime" actionsRole="employee"/>

      {toast && <div style={{padding:'8px 16px',background:'var(--accent-dim,rgba(100,200,100,0.1))',border:'1px solid var(--accent)',borderRadius:8,marginBottom:12,fontSize:12,color:'var(--text-primary)'}}>{toast}</div>}

      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {tabBtn('pending',   '⏳ Ausstehend', counts.pending,  '#f59e0b')}
        {tabBtn('published', '✅ Veröffentlicht', counts.published)}
        {tabBtn('rejected',  '❌ Abgelehnt', counts.rejected,  '#ef4444')}
        {tabBtn('flagged',   '⚑ Gemeldet',   counts.flagged,  '#f97316')}
        {tabBtn('deleted',   '🗑 Gelöscht',   counts.deleted,  '#6b7280')}
        {tabBtn('all',       'Alle',          counts.all)}
        <input type="text" placeholder="Suchen…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{marginLeft:'auto',padding:'5px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:12,minWidth:160}}/>
        <button onClick={refetch} style={{padding:'5px 10px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:14}}>↻</button>
      </div>

      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>🟢 Realtime · {filtered.length} Einträge</div>

      {loading ? <div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Laden…</div> : (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
              {['Vorschau','Titel','Kategorie','Preis','Status','Erstellt','Aktionen'].map(h=>(
                <th key={h} style={{padding:'8px 12px',textAlign:'left',color:'var(--text-muted)',fontWeight:600,fontSize:10,textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(w => {
                const isDeleted = w.status==='deleted' || deletedIds.has(w.id);
                const isBusy = busy === w.id;
                return (
                  <tr key={w.id} style={{
                    borderBottom:'1px solid var(--border)',
                    opacity: isDeleted ? 0.5 : 1,
                    background: isDeleted ? 'var(--bg-tertiary)' : 'transparent',
                    textDecoration: isDeleted ? 'line-through' : 'none',
                  }}
                  onMouseEnter={e=>{if(!isDeleted)(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-hover)';}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLTableRowElement).style.background=isDeleted?'var(--bg-tertiary)':'transparent';}}>
                    <td style={{padding:'8px 12px'}}>
                      {w.thumbnail_url
                        ?<img src={w.thumbnail_url} alt="" style={{width:36,height:36,objectFit:'cover',borderRadius:6,display:'block'}}/>
                        :<div style={{width:36,height:36,borderRadius:6,background:'var(--bg-tertiary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🖼️</div>}
                    </td>
                    <td style={{padding:'8px 12px',color:'var(--text-primary)',fontWeight:500,maxWidth:180}}>
                      <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{w.title||'—'}</div>
                      {w.admin_comment&&<div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>💬 {w.admin_comment}</div>}
                    </td>
                    <td style={{padding:'8px 12px',color:'var(--text-muted)'}}>{w.category||'—'}</td>
                    <td style={{padding:'8px 12px',color:'var(--text-muted)'}}>{fmtPrice(w.price)}</td>
                    <td style={{padding:'8px 12px'}}>
                      <Badge variant={STATUS_VARIANT[w.status]??'neutral'}>
                        {w.status==='published'?'Veröffentlicht':w.status==='draft'?'Entwurf':w.status==='rejected'?'Abgelehnt':w.status==='flagged'?'Gemeldet':w.status==='deleted'?'Gelöscht':w.status||'—'}
                      </Badge>
                    </td>
                    <td style={{padding:'8px 12px',color:'var(--text-muted)',fontSize:11}}>{timeAgo(w.created_at)}</td>
                    <td style={{padding:'8px 12px'}}>
                      {isDeleted ? (
                        <span style={{fontSize:10,color:'var(--text-muted)',fontStyle:'italic'}}>Gelöscht — wartet auf Admin</span>
                      ) : (
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {(w.approval_status==='pending'||w.status==='pending') && <>
                            <button disabled={isBusy} onClick={()=>call('approve_work',w.id)} style={btnStyle('green')}>✓ Approve</button>
                            <button disabled={isBusy} onClick={()=>{setRejectModal({id:w.id,title:w.title||'Werk'});setRejectReason('');}} style={btnStyle('red')}>✗ Reject</button>
                          </>}
                          {w.status==='published' && (
                            <button disabled={isBusy} onClick={()=>call('unpublish_work',w.id)} style={btnStyle('gray')}>⤵ Unpublish</button>
                          )}
                          {(w.status==='draft'||w.status==='rejected') && (
                            <button disabled={isBusy} onClick={()=>call('publish_work',w.id)} style={btnStyle('green')}>⤴ Publish</button>
                          )}
                          {w.status!=='flagged' && w.status!=='deleted' && (
                            <button disabled={isBusy} onClick={()=>call('flag_work',w.id)} style={btnStyle('orange')}>⚑ Flag</button>
                          )}
                          {w.status==='flagged' && (
                            <button disabled={isBusy} onClick={()=>call('unflag_work',w.id)} style={btnStyle('green')}>✓ Unflag</button>
                          )}
                          {w.sensitivity_status==='flagged' && (
                            <button disabled={isBusy} onClick={()=>call('clear_sensitive_work',w.id)} style={btnStyle('purple')}>🔓 Sensitiv OK</button>
                          )}
                          {!w.sensitivity_status && w.status!=='deleted' && (
                            <button disabled={isBusy} onClick={()=>call('mark_sensitive_work',w.id,{reason:'Manuell markiert'})} style={btnStyle('purple')}>🔒 Sensitiv</button>
                          )}
                          <button disabled={isBusy} onClick={()=>softDelete(w.id,w.title||'Werk')} style={btnStyle('danger')}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Keine Einträge gefunden.</div>}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--bg-primary)',borderRadius:16,padding:24,maxWidth:480,width:'100%',border:'1px solid var(--border)'}}>
            <h3 style={{margin:'0 0 8px',fontSize:16,color:'var(--text-primary)'}}>Werk ablehnen</h3>
            <p style={{fontSize:13,color:'var(--text-muted)',margin:'0 0 16px'}}>„{rejectModal.title}"</p>
            <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Ablehnungsgrund eingeben…" rows={4}
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13,resize:'vertical',boxSizing:'border-box'}}/>
            <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}>
              <button onClick={()=>setRejectModal(null)} style={{padding:'8px 16px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer'}}>Abbrechen</button>
              <button onClick={async()=>{
                if(!rejectReason.trim()){alert('Bitte Ablehnungsgrund angeben');return;}
                const ok=await call('reject_work',rejectModal.id,{reason:rejectReason});
                if(ok){showToast('Werk abgelehnt');setRejectModal(null);}
              }} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#ef4444',color:'#fff',cursor:'pointer',fontWeight:600}}>
                Ablehnen
              </button>
            </div>
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
}

function btnStyle(color: 'green'|'red'|'orange'|'gray'|'purple'|'danger'): React.CSSProperties {
  const map = {
    green:  {border:'1px solid #22c55e44',color:'#22c55e'},
    red:    {border:'1px solid #ef444444',color:'#ef4444'},
    orange: {border:'1px solid #f9731644',color:'#f97316'},
    gray:   {border:'1px solid var(--border)',color:'var(--text-muted)'},
    purple: {border:'1px solid #a855f744',color:'#a855f7'},
    danger: {border:'1px solid #ef444444',color:'#ef4444'},
  };
  return {padding:'3px 8px',borderRadius:6,background:'transparent',fontSize:10,cursor:'pointer',fontWeight:600,...map[color]};
}
