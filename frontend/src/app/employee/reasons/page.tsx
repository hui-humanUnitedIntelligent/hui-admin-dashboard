// frontend/src/app/employee/reasons/page.tsx
// Employee: Ablehnungsgründe — Realtime + Soft-Delete
'use client';
import { useState } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useScoreFailures } from '@/lib/hooks/useSupabase';
import { getSessionToken } from '@/lib/session';

function fmtEur(n:number|null|undefined){if(!n)return'—';return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);}
function timeAgo(iso:string|null|undefined){if(!iso)return'—';const d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);if(d===0)return'Heute';if(d<7)return`${d}d`;if(d<30)return`${Math.floor(d/7)}w`;return`${Math.floor(d/30)}mo`;}
function scoreVariant(s:number):'danger'|'warning'|'neutral'{return s<40?'danger':s<60?'warning':'neutral';}

export default function EmployeeReasonsPage() {
  const { failures, loading, refetch } = useScoreFailures({ limit: 200 });
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<string|null>(null);
  const [deleting, setDeleting] = useState<string|null>(null);
  const [hidden,   setHidden]   = useState<Set<string>>(new Set());

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Diesen Eintrag löschen?')) return;
    setDeleting(id);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/employee/reasons/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setHidden(h => new Set([...h, id])); refetch(); }
    } finally { setDeleting(null); }
  }

  const filtered = failures.filter(i => {
    if (hidden.has(i.id)) return false;
    const q = search.toLowerCase();
    return !q||(i.project_name||'').toLowerCase().includes(q)||(i.kategorie||'').toLowerCase().includes(q)||(i.grund||'').toLowerCase().includes(q);
  });

  return (
    <EmployeeLayout title="Ablehnungsgründe">
      <PageHeader title="Ablehnungsgründe" subtitle="Live-Übersicht · Realtime" actionsRole="employee"/>
      <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'center'}}>
        <input type="text" placeholder="Projektname, Kategorie oder Grund…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,maxWidth:400,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:13}}/>
        <button onClick={refetch} style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:14}}>↻</button>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10}}>🟢 Realtime aktiv · {filtered.length} Einträge</div>
      {loading?<div style={{color:'var(--text-muted)',padding:40,textAlign:'center'}}>Laden…</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(item=>(
            <div key={item.id} onClick={()=>setSelected(selected===item.id?null:item.id)} style={{background:'var(--bg-secondary)',border:`1px solid ${selected===item.id?'var(--accent)':'var(--border)'}`,borderRadius:10,padding:'14px 18px',cursor:'pointer',transition:'border-color 0.15s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:13}}>{item.project_name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{item.kategorie||'—'} · {fmtEur(item.funding_goal)} · {timeAgo(item.created_at)}</div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <Badge variant={scoreVariant(item.ai_score)}>Score: {item.ai_score}</Badge>
                  <button onClick={e=>handleDelete(item.id,e)} disabled={deleting===item.id} style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--red-dim,#ff6b6b44)',background:'transparent',color:'var(--red,#ff6b6b)',fontSize:11,cursor:'pointer',opacity:deleting===item.id?0.5:1}}>
                    {deleting===item.id?'…':'Löschen'}
                  </button>
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
          ))}
          {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Keine Ablehnungsgründe gefunden.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
