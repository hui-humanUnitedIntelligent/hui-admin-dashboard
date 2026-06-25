// frontend/src/app/employee/impact/page.tsx
// Employee: Impact Projekte — Realtime + Soft-Delete
'use client';
import { useState } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useImpactProjects } from '@/lib/hooks/useSupabase';
import { getSessionToken } from '@/lib/session';

function fmtEur(n:number|null|undefined){if(!n)return'—';return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);}

export default function EmployeeImpactPage() {
  const { projects, loading } = useImpactProjects();
  const [search, setSearch] = useState('');
  const [tab,    setTab]    = useState<'all'|'active'|'inactive'>('all');
  const [deleting, setDeleting] = useState<string|null>(null);
  const [hidden,   setHidden]   = useState<Set<string>>(new Set());

  async function handleDelete(id: string) {
    if (!confirm('Dieses Projekt löschen?')) return;
    setDeleting(id);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/employee/impact/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setHidden(h => new Set([...h, id]));
    } finally { setDeleting(null); }
  }

  const filtered = projects.filter(p => {
    if (hidden.has(p.id)) return false;
    const matchTab = tab==='all'?true:tab==='active'?p.status==='active':p.status!=='active';
    const q = search.toLowerCase();
    return matchTab&&(!q||(p.name||'').toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q));
  });

  return (
    <EmployeeLayout title="Impact Projekte">
      <PageHeader title="Impact Projekte" subtitle="Live-Übersicht · Realtime" actionsRole="employee"/>
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {(['all','active','inactive'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'6px 14px',borderRadius:20,border:'1px solid var(--border)',background:tab===t?'var(--accent)':'transparent',color:tab===t?'#0f1117':'var(--text-muted)',fontWeight:600,fontSize:12,cursor:'pointer'}}>
            {t==='all'?'Alle':t==='active'?'Aktiv':'Inaktiv'}
          </button>
        ))}
        <input type="text" placeholder="Name oder Kategorie…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginLeft:'auto',padding:'6px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:12,minWidth:180}}/>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10}}>🟢 Realtime aktiv · {filtered.length} Projekte</div>
      {loading?<div style={{color:'var(--text-muted)',padding:40,textAlign:'center'}}>Laden…</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(p=>(
            <div key={p.id} style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:36,height:36,borderRadius:8,background:p.color||'var(--accent-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{p.icon||'🌿'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:13}}>{p.name||'—'}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{p.category||'—'} · {p.votes||0} Votes</div>
              </div>
              <div style={{display:'flex',gap:12,alignItems:'center',flexShrink:0}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Ziel</div>
                  <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:13}}>{fmtEur(p.goal_eur??undefined)}</div>
                </div>
                <Badge variant={p.status==='active'?'success':'neutral'}>{p.status==='active'?'Aktiv':p.status||'—'}</Badge>
                <button onClick={()=>handleDelete(p.id)} disabled={deleting===p.id} style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--red-dim,#ff6b6b44)',background:'transparent',color:'var(--red,#ff6b6b)',fontSize:11,cursor:'pointer',opacity:deleting===p.id?0.5:1}}>
                  {deleting===p.id?'…':'Löschen'}
                </button>
              </div>
            </div>
          ))}
          {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Keine Impact-Projekte gefunden.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
