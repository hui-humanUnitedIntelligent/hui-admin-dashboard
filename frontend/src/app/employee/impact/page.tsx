import type { HuiImpactProject } from '@/lib/hooks/useImpact';
// frontend/src/app/employee/impact/page.tsx — volle Content-Rechte
'use client';
import { useState, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useImpactProjects } from '@/lib/hooks/useSupabase';

function fmtEur(n:number|null|undefined){if(!n)return'—';return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);}

export default function EmployeeImpactPage() {
  const { projects, loading } = useImpactProjects();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'active'|'inactive'|'deleted'|'all'>('active');
  const [busy, setBusy] = useState<string|null>(null);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg:string)=>{setToast(msg);setTimeout(()=>setToast(''),3000);},[]);

  async function call(action:string, id:string, data?:Record<string,unknown>) {
    setBusy(id);
    try {
      const res = await fetch('/api/employee/content',{
        method:'POST',headers:{'Content-Type':'application/json',},
        body:JSON.stringify({action,id,data}),
      });
      if(res.ok){return true;}
      showToast('Fehler'); return false;
    } catch{showToast('Netzwerkfehler');return false;}
    finally{setBusy(null);}
  }

  const filtered = projects.filter((p: HuiImpactProject)=>{
    if(tab==='active')   return p.status==='active';
    if(tab==='inactive') return p.status==='inactive'||p.status==='paused';
    if(tab==='deleted')  return p.status==='deleted';
    return true;
  }).filter((p: HuiImpactProject)=>{
    const q=search.toLowerCase();
    return !q||(p.name||'').toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q);
  });

  const tabBtn=(t:typeof tab,label:string,color?:string)=>(
    <button onClick={()=>setTab(t)} style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${tab===t?(color||'var(--accent)'):'var(--border)'}`,background:tab===t?(color||'var(--accent)'):'transparent',color:tab===t?(color?'#fff':'#0f1117'):'var(--text-muted)',fontWeight:700,fontSize:11,cursor:'pointer'}}>
      {label}
    </button>
  );

  return (
    <EmployeeLayout title="Impact Projekte">
      <PageHeader title="Impact Projekte" subtitle="Volle Content-Rechte · Realtime" actionsRole="employee"/>
      {toast&&<div style={{padding:'8px 16px',background:'var(--accent-dim,rgba(100,200,100,0.1))',border:'1px solid var(--accent)',borderRadius:8,marginBottom:12,fontSize:12}}>{toast}</div>}
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {tabBtn('active','✅ Aktiv')}
        {tabBtn('inactive','⏸ Inaktiv','#6b7280')}
        {tabBtn('deleted','🗑 Gelöscht','#6b7280')}
        {tabBtn('all','Alle')}
        <input type="text" placeholder="Suchen…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginLeft:'auto',padding:'5px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:12,minWidth:160}}/>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>🟢 Realtime · {filtered.length} Projekte</div>
      {loading?<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Laden…</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map((p: HuiImpactProject)=>{
            const isBusy=busy===p.id;
            const isDeleted=p.status==='deleted';
            return(
              <div key={p.id} style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',gap:14,opacity:isDeleted?0.5:1,textDecoration:isDeleted?'line-through':'none'}}>
                <div style={{width:36,height:36,borderRadius:8,background:p.color||'var(--accent-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{p.icon||'🌿'}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:13}}>{p.name||'—'}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{p.category||'—'} · {p.votes||0} Votes · Ziel: {fmtEur(p.goal_eur??undefined)}</div>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                  <Badge variant={p.status==='active'?'success':'neutral'}>{p.status==='active'?'Aktiv':p.status||'—'}</Badge>
                  {!isDeleted&&<>
                    {p.status==='active'
                      ?<button disabled={isBusy} onClick={()=>call('update_impact',p.id,{status:'inactive'})} style={{padding:'3px 8px',borderRadius:6,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:10,cursor:'pointer'}}>⏸ Deaktivieren</button>
                      :<button disabled={isBusy} onClick={()=>call('update_impact',p.id,{status:'active'})} style={{padding:'3px 8px',borderRadius:6,border:'1px solid #22c55e44',background:'transparent',color:'#22c55e',fontSize:10,cursor:'pointer'}}>▶ Aktivieren</button>
                    }
                    <button disabled={isBusy} onClick={async()=>{
                      if(!confirm(`„${p.name}" löschen?`))return;
                      await call('soft_delete_impact',p.id);
                      showToast('Gelöscht — Superadmin wird informiert');
                    }} style={{padding:'3px 8px',borderRadius:6,border:'1px solid #ef444444',background:'transparent',color:'#ef4444',fontSize:10,cursor:'pointer'}}>🗑</button>
                  </>}
                  {isDeleted&&<span style={{fontSize:10,color:'var(--text-muted)',fontStyle:'italic'}}>Wartet auf Admin</span>}
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Keine Projekte.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
