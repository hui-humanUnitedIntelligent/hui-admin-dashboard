// frontend/src/app/employee/experiences/page.tsx
// Employee: Erlebnisse & Projekte — volle Content-Rechte
'use client';
import { useState, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useExperiencesAndProjects } from '@/lib/hooks/useSupabase';
import { getSessionToken } from '@/lib/session';

type TabKey = 'pending'|'approved'|'rejected'|'deleted'|'all';
const VARIANT: Record<string,'success'|'warning'|'danger'|'neutral'> = {approved:'success',pending:'warning',rejected:'danger',deleted:'neutral'};
function fmtPrice(n:number|null|undefined){if(!n)return'—';return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);}
function timeAgo(iso:string|null|undefined){if(!iso)return'—';const d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);if(d===0)return'Heute';if(d<7)return`${d}d`;return`${Math.floor(d/30)}mo`;}

export default function EmployeeExperiencesPage() {
  const { entries, loading, refetch } = useExperiencesAndProjects({ limit: 500 });
  const [tab, setTab] = useState<TabKey>('pending');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string|null>(null);
  const [toast, setToast] = useState('');
  const [rejectTarget, setRejectTarget] = useState<{id:string;title:string;source:'experiences'|'projects'}|null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const showToast = useCallback((msg:string)=>{setToast(msg);setTimeout(()=>setToast(''),3000);},[]);

  async function call(action:string, id:string, data?:Record<string,unknown>) {
    setBusy(id);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/employee/content',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({action,id,data}),
      });
      if(res.ok){refetch();return true;}
      else{showToast('Fehler');return false;}
    } catch{showToast('Netzwerkfehler');return false;}
    finally{setBusy(null);}
  }

  const SUBMITTED_EXP = ['submitted','pending','pending_review','review','waiting_for_approval'];
  const isPendingExp = (e: typeof entries[0]) => 
    SUBMITTED_EXP.includes(e.approval_status||'') || SUBMITTED_EXP.includes(e.status||'');

  const counts = {
    pending: entries.filter(isPendingExp).length,
    approved:entries.filter(e=>e.approval_status==='approved'||e.status==='published').length,
    rejected:entries.filter(e=>e.approval_status==='rejected'||e.status==='rejected').length,
    deleted: entries.filter(e=>e.approval_status==='deleted'||e.status==='deleted').length,
    all:     entries.length,
  };

  const filtered = entries.filter(e=>{
    if(tab==='pending')  return isPendingExp(e);
    if(tab==='approved') return e.approval_status==='approved'||e.status==='published';
    if(tab==='rejected') return e.approval_status==='rejected'||e.status==='rejected';
    if(tab==='deleted')  return e.approval_status==='deleted'||e.status==='deleted';
    return true;
  }).filter(e=>{
    const q=search.toLowerCase();
    return !q||(e.title||'').toLowerCase().includes(q)||(e.category||'').toLowerCase().includes(q);
  });

  const tabBtn=(t:TabKey,label:string,count:number,color?:string)=>(
    <button onClick={()=>setTab(t)} style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${tab===t?(color||'var(--accent)'):'var(--border)'}`,background:tab===t?(color||'var(--accent)'):'transparent',color:tab===t?(color?'#fff':'#0f1117'):'var(--text-muted)',fontWeight:700,fontSize:11,cursor:'pointer',display:'flex',gap:5,alignItems:'center'}}>
      {label}{count>0&&<span style={{background:'rgba(255,255,255,0.25)',borderRadius:99,padding:'0 5px',fontSize:10}}>{count}</span>}
    </button>
  );

  const btnS=(color:'green'|'red'|'gray'|'purple'):React.CSSProperties=>{
    const m={green:{border:'1px solid #22c55e44',color:'#22c55e'},red:{border:'1px solid #ef444444',color:'#ef4444'},gray:{border:'1px solid var(--border)',color:'var(--text-muted)'},purple:{border:'1px solid #a855f744',color:'#a855f7'}};
    return{padding:'3px 8px',borderRadius:6,background:'transparent',fontSize:10,cursor:'pointer',fontWeight:600,...m[color]};
  };

  return (
    <EmployeeLayout title="Erlebnisse & Projekte">
      <PageHeader title="Erlebnisse & Projekte" subtitle="Volle Content-Rechte · Realtime" actionsRole="employee"/>
      {toast&&<div style={{padding:'8px 16px',background:'var(--accent-dim,rgba(100,200,100,0.1))',border:'1px solid var(--accent)',borderRadius:8,marginBottom:12,fontSize:12}}>{toast}</div>}
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {tabBtn('pending','⏳ Ausstehend',counts.pending,'#f59e0b')}
        {tabBtn('approved','✅ Genehmigt',counts.approved)}
        {tabBtn('rejected','❌ Abgelehnt',counts.rejected,'#ef4444')}
        {tabBtn('deleted','🗑 Gelöscht',counts.deleted,'#6b7280')}
        {tabBtn('all','Alle',counts.all)}
        <input type="text" placeholder="Suchen…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginLeft:'auto',padding:'5px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:12,minWidth:160}}/>
        <button onClick={refetch} style={{padding:'5px 10px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer'}}>↻</button>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>🟢 Realtime · {filtered.length} Einträge</div>
      {loading?<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Laden…</div>:(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
              {['Quelle','Titel','Kategorie','Preis','Status','Erstellt','Aktionen'].map(h=>(
                <th key={h} style={{padding:'8px 12px',textAlign:'left',color:'var(--text-muted)',fontWeight:600,fontSize:10,textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(e=>{
                const isBusy=busy===e.id;
                const isDeleted=e.approval_status==='deleted'||e.status==='deleted';
                const actionKey=e._source==='experiences'?'experience':'project';
                return(
                  <tr key={e.id} style={{borderBottom:'1px solid var(--border)',opacity:isDeleted?0.5:1,background:isDeleted?'var(--bg-tertiary)':'transparent',textDecoration:isDeleted?'line-through':'none'}}
                    onMouseEnter={ev=>{if(!isDeleted)(ev.currentTarget as HTMLTableRowElement).style.background='var(--bg-hover)';}}
                    onMouseLeave={ev=>{(ev.currentTarget as HTMLTableRowElement).style.background=isDeleted?'var(--bg-tertiary)':'transparent';}}>
                    <td style={{padding:'8px 12px'}}><Badge variant={e._source==='experiences'?'neutral':'success'}>{e._source==='experiences'?'Erlebnis':'Projekt'}</Badge></td>
                    <td style={{padding:'8px 12px',color:'var(--text-primary)',fontWeight:500}}>
                      {e.title||'—'}
                      {e.admin_comment&&<div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>💬 {e.admin_comment}</div>}
                    </td>
                    <td style={{padding:'8px 12px',color:'var(--text-muted)'}}>{e.category||'—'}</td>
                    <td style={{padding:'8px 12px',color:'var(--text-muted)'}}>{fmtPrice(e.price)}</td>
                    <td style={{padding:'8px 12px'}}>
                      <Badge variant={VARIANT[e.approval_status||e.status||'']??'neutral'}>
                        {e.approval_status==='approved'?'Genehmigt':e.approval_status==='pending'?'Ausstehend':e.approval_status==='rejected'?'Abgelehnt':e.status||'—'}
                      </Badge>
                    </td>
                    <td style={{padding:'8px 12px',color:'var(--text-muted)',fontSize:11}}>{timeAgo(e.created_at)}</td>
                    <td style={{padding:'8px 12px'}}>
                      {isDeleted?<span style={{fontSize:10,color:'var(--text-muted)',fontStyle:'italic'}}>Gelöscht — wartet auf Admin</span>:(
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {(e.approval_status==='pending'||(!e.approval_status&&e.status==='draft'))&&<>
                            <button disabled={isBusy} onClick={()=>call(`approve_${actionKey}`,e.id)} style={btnS('green')}>✓ Approve</button>
                            <button disabled={isBusy} onClick={()=>{setRejectTarget({id:e.id,title:e.title||'',source:e._source});setRejectReason('');}} style={btnS('red')}>✗ Reject</button>
                          </>}
                          {e.approval_status==='approved'&&(
                            <button disabled={isBusy} onClick={()=>call(`reject_${actionKey}`,e.id,{reason:'Zurückgezogen'})} style={btnS('gray')}>⤵ Zurückziehen</button>
                          )}
                          {e.sensitivity_status==='flagged'&&(
                            <button disabled={isBusy} onClick={()=>call(`clear_sensitive_${actionKey}`,e.id)} style={btnS('purple')}>🔓 OK</button>
                          )}
                          {!e.sensitivity_status&&<button disabled={isBusy} onClick={()=>call(`mark_sensitive_${actionKey}`,e.id,{reason:'Manuell markiert'})} style={btnS('purple')}>🔒</button>}
                          <button disabled={isBusy} onClick={async()=>{
                            if(!confirm(`„${e.title||'Eintrag'}" löschen?`))return;
                            await call(`soft_delete_${actionKey}`,e.id);
                            showToast('Gelöscht — Superadmin wird informiert');
                          }} style={btnS('red')}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Keine Einträge.</div>}
        </div>
      )}
      {rejectTarget&&(
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--bg-primary)',borderRadius:16,padding:24,maxWidth:480,width:'100%',border:'1px solid var(--border)'}}>
            <h3 style={{margin:'0 0 8px',fontSize:16,color:'var(--text-primary)'}}>Eintrag ablehnen</h3>
            <p style={{fontSize:13,color:'var(--text-muted)',margin:'0 0 16px'}}>„{rejectTarget.title}"</p>
            <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Ablehnungsgrund…" rows={4}
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13,resize:'vertical',boxSizing:'border-box'}}/>
            <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}>
              <button onClick={()=>setRejectTarget(null)} style={{padding:'8px 16px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer'}}>Abbrechen</button>
              <button onClick={async()=>{
                if(!rejectReason.trim()){alert('Bitte Grund angeben');return;}
                const act=rejectTarget.source==='experiences'?'reject_experience':'reject_project';
                const ok=await call(act,rejectTarget.id,{reason:rejectReason});
                if(ok){showToast('Abgelehnt');setRejectTarget(null);}
              }} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#ef4444',color:'#fff',cursor:'pointer',fontWeight:600}}>Ablehnen</button>
            </div>
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
}
