// frontend/src/app/employee/reasons/page.tsx — volle Content-Rechte
'use client';
import { useState, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useScoreFailures } from '@/lib/hooks/useSupabase';

function fmtEur(n:number|null|undefined){if(!n)return'—';return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);}
function timeAgo(iso:string|null|undefined){if(!iso)return'—';const d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);if(d===0)return'Heute';if(d<7)return`${d}d`;return`${Math.floor(d/30)}mo`;}
function scoreVariant(s:number):'danger'|'warning'|'neutral'{return s<40?'danger':s<60?'warning':'neutral';}

export default function EmployeeReasonsPage() {
  const { failures, loading, refetch } = useScoreFailures({ limit: 200 });
  const [tab, setTab] = useState<'active'|'deleted'>('active');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string|null>(null);
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
      if(res.ok){refetch();return true;}
      showToast('Fehler'); return false;
    } catch{showToast('Netzwerkfehler');return false;}
    finally{setBusy(null);}
  }

  const filtered = failures.filter(f=>{
    const fStatus=(f as {status?:string}).status;
    if(tab==='deleted') return fStatus==='deleted';
    return fStatus!=='deleted';
  }).filter(f=>{
    const q=search.toLowerCase();
    return !q||(f.project_name||'').toLowerCase().includes(q)||(f.kategorie||'').toLowerCase().includes(q)||(f.grund||'').toLowerCase().includes(q);
  });

  return (
    <EmployeeLayout title="Ablehnungsgründe">
      <PageHeader title="Ablehnungsgründe" subtitle="Volle Content-Rechte · Realtime" actionsRole="employee"/>
      {toast&&<div style={{padding:'8px 16px',background:'var(--accent-dim,rgba(100,200,100,0.1))',border:'1px solid var(--accent)',borderRadius:8,marginBottom:12,fontSize:12}}>{toast}</div>}
      <div style={{display:'flex',gap:6,marginBottom:14,alignItems:'center'}}>
        {(['active','deleted'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${tab===t?'var(--accent)':'var(--border)'}`,background:tab===t?'var(--accent)':'transparent',color:tab===t?'#0f1117':'var(--text-muted)',fontWeight:700,fontSize:11,cursor:'pointer'}}>
            {t==='active'?'Aktiv':'🗑 Gelöscht'}
          </button>
        ))}
        <input type="text" placeholder="Suchen…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginLeft:'auto',flex:1,maxWidth:360,padding:'5px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:12}}/>
        <button onClick={refetch} style={{padding:'5px 10px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer'}}>↻</button>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>🟢 Realtime · {filtered.length} Einträge</div>
      {loading?<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Laden…</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(item=>{
            const isBusy=busy===item.id;
            const isDeleted=(item as {status?:string}).status==='deleted';
            return(
              <div key={item.id} onClick={()=>setSelected(selected===item.id?null:item.id)} style={{background:'var(--bg-secondary)',border:`1px solid ${selected===item.id?'var(--accent)':'var(--border)'}`,borderRadius:10,padding:'14px 18px',cursor:'pointer',opacity:isDeleted?0.5:1,textDecoration:isDeleted?'line-through':'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:13}}>{item.project_name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{item.kategorie||'—'} · {fmtEur(item.funding_goal)} · {timeAgo(item.created_at)}</div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <Badge variant={scoreVariant(item.ai_score)}>Score: {item.ai_score}</Badge>
                    {!isDeleted&&<button disabled={isBusy} onClick={async e=>{
                      e.stopPropagation();
                      if(!confirm(`„${item.project_name}" löschen?`))return;
                      await call('soft_delete_reason',item.id);
                      showToast('Gelöscht — Superadmin wird informiert');
                    }} style={{padding:'3px 8px',borderRadius:6,border:'1px solid #ef444444',background:'transparent',color:'#ef4444',fontSize:10,cursor:'pointer',fontWeight:600}}>🗑</button>}
                    {isDeleted&&<span style={{fontSize:10,color:'var(--text-muted)',fontStyle:'italic'}}>Wartet auf Admin</span>}
                  </div>
                </div>
                {selected===item.id&&(
                  <div style={{marginTop:10,padding:'10px 14px',borderRadius:8,background:'var(--bg-primary)',border:'1px solid var(--border)',fontSize:13,color:'var(--text-secondary)',lineHeight:1.6}}>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>Ablehnungsgrund:</div>
                    {item.grund||'—'}
                    {item.short_desc&&<div style={{marginTop:8,fontSize:12,color:'var(--text-muted)'}}>{item.short_desc}</div>}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Keine Einträge.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
