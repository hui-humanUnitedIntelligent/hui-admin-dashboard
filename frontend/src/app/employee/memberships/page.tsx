// frontend/src/app/employee/memberships/page.tsx — volle Content-Rechte
'use client';
import { useState, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useMemberships } from '@/lib/hooks/useSupabase';
import { getSessionToken } from '@/lib/session';

function fmtDate(iso:string|null|undefined){if(!iso)return'—';return new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});}
function timeAgo(iso:string|null|undefined){if(!iso)return'—';const d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);if(d===0)return'Heute';if(d<7)return`${d}d`;return`${Math.floor(d/30)}mo`;}

export default function EmployeeMembershipsPage() {
  const { memberships, loading, refetch } = useMemberships({ limit: 500 });
  const [tab, setTab] = useState<'active'|'expired'|'deleted'|'all'>('active');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string|null>(null);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg:string)=>{setToast(msg);setTimeout(()=>setToast(''),3000);},[]);

  async function call(action:string, id:string, data?:Record<string,unknown>) {
    setBusy(id);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/employee/content',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({action,id,data}),
      });
      if(res.ok){refetch();return true;}
      showToast('Fehler'); return false;
    } catch{showToast('Netzwerkfehler');return false;}
    finally{setBusy(null);}
  }

  const filtered = memberships.filter(m=>{
    if(tab==='active')  return m.status==='active';
    if(tab==='expired') return m.status!=='active'&&m.status!=='deleted';
    if(tab==='deleted') return m.status==='deleted';
    return true;
  }).filter(m=>{
    const q=search.toLowerCase();
    return !q||(m.membership_type||'').toLowerCase().includes(q)||(m.user_id||'').toLowerCase().includes(q);
  });

  const tabBtn=(t:typeof tab,label:string,color?:string)=>(
    <button onClick={()=>setTab(t)} style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${tab===t?(color||'var(--accent)'):'var(--border)'}`,background:tab===t?(color||'var(--accent)'):'transparent',color:tab===t?(color?'#fff':'#0f1117'):'var(--text-muted)',fontWeight:700,fontSize:11,cursor:'pointer'}}>
      {label}
    </button>
  );

  return (
    <EmployeeLayout title="Mitgliedschaften">
      <PageHeader title="Mitgliedschaften" subtitle="Volle Content-Rechte · Realtime" actionsRole="employee"/>
      {toast&&<div style={{padding:'8px 16px',background:'var(--accent-dim,rgba(100,200,100,0.1))',border:'1px solid var(--accent)',borderRadius:8,marginBottom:12,fontSize:12}}>{toast}</div>}
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {tabBtn('active','✅ Aktiv')}
        {tabBtn('expired','⏸ Abgelaufen','#6b7280')}
        {tabBtn('deleted','🗑 Gelöscht','#6b7280')}
        {tabBtn('all','Alle')}
        <input type="text" placeholder="Suchen…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginLeft:'auto',padding:'5px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:12,minWidth:160}}/>
        <button onClick={refetch} style={{padding:'5px 10px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer'}}>↻</button>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>🟢 Realtime · {filtered.length} Mitgliedschaften</div>
      {loading?<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Laden…</div>:(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
              {['ID','Typ','Gewicht','Status','Start','Ablauf','Aktionen'].map(h=>(
                <th key={h} style={{padding:'8px 12px',textAlign:'left',color:'var(--text-muted)',fontWeight:600,fontSize:10,textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(m=>{
                const isBusy=busy===m.id;
                const isDeleted=m.status==='deleted';
                return(
                  <tr key={m.id} style={{borderBottom:'1px solid var(--border)',opacity:isDeleted?0.5:1,background:isDeleted?'var(--bg-tertiary)':'transparent',textDecoration:isDeleted?'line-through':'none'}}
                    onMouseEnter={e=>{if(!isDeleted)(e.currentTarget as HTMLTableRowElement).style.background='var(--bg-hover)';}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLTableRowElement).style.background=isDeleted?'var(--bg-tertiary)':'transparent';}}>
                    <td style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-muted)'}}>{m.id.slice(0,8)}…</td>
                    <td style={{padding:'8px 12px'}}><Badge variant={m.membership_type==='free'?'neutral':m.membership_type==='wirker'?'purple':'info'}>{m.membership_type}</Badge></td>
                    <td style={{padding:'8px 12px',color:'var(--accent)',fontFamily:'var(--font-mono)'}}>{m.vote_weight}x</td>
                    <td style={{padding:'8px 12px'}}><Badge variant={m.status==='active'?'success':m.status==='deleted'?'danger':'neutral'}>{m.status||'—'}</Badge></td>
                    <td style={{padding:'8px 12px',color:'var(--text-muted)',fontSize:11}}>{fmtDate(m.started_at??undefined)}</td>
                    <td style={{padding:'8px 12px',color:m.expires_at?'var(--gold)':'var(--text-muted)',fontSize:11}}>{m.expires_at?new Date(m.expires_at).toLocaleDateString('de-DE'):'∞'}</td>
                    <td style={{padding:'8px 12px'}}>
                      {isDeleted?<span style={{fontSize:10,color:'var(--text-muted)',fontStyle:'italic'}}>Wartet auf Admin</span>:(
                        <div style={{display:'flex',gap:4}}>
                          {m.status==='active'
                            ?<button disabled={isBusy} onClick={()=>call('deactivate_membership',m.id)} style={{padding:'3px 8px',borderRadius:6,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:10,cursor:'pointer'}}>⏸ Deaktivieren</button>
                            :<button disabled={isBusy} onClick={()=>call('update_membership',m.id,{membership_type:m.membership_type,vote_weight:m.vote_weight})} style={{padding:'3px 8px',borderRadius:6,border:'1px solid #22c55e44',background:'transparent',color:'#22c55e',fontSize:10,cursor:'pointer'}}>▶ Aktivieren</button>
                          }
                          <button disabled={isBusy} onClick={async()=>{
                            if(!confirm('Mitgliedschaft löschen?'))return;
                            await call('soft_delete_membership',m.id);
                            showToast('Gelöscht — Superadmin wird informiert');
                          }} style={{padding:'3px 8px',borderRadius:6,border:'1px solid #ef444444',background:'transparent',color:'#ef4444',fontSize:10,cursor:'pointer'}}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Keine Mitgliedschaften.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
