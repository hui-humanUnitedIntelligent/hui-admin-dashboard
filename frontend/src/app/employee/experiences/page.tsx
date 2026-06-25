// frontend/src/app/employee/experiences/page.tsx
// Employee: Erlebnisse & Projekte — Realtime + Soft-Delete
'use client';
import { useState } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useExperiencesAndProjects } from '@/lib/hooks/useSupabase';
import { getSessionToken } from '@/lib/session';

const STATUS_VARIANT: Record<string,'success'|'warning'|'danger'|'neutral'> = {
  approved:'success',pending:'warning',rejected:'danger',draft:'neutral',
};
function fmtPrice(n:number|null|undefined){if(!n)return'—';return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);}
function timeAgo(iso:string|null|undefined){if(!iso)return'—';const d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);if(d===0)return'Heute';if(d<7)return`${d}d`;if(d<30)return`${Math.floor(d/7)}w`;return`${Math.floor(d/30)}mo`;}

export default function EmployeeExperiencesPage() {
  const { entries, loading, refetch } = useExperiencesAndProjects({ limit: 500 });
  const [search, setSearch] = useState('');
  const [tab,    setTab]    = useState<'all'|'approved'|'pending'|'rejected'>('all');
  const [deleting, setDeleting] = useState<string|null>(null);
  const [hidden,   setHidden]   = useState<Set<string>>(new Set());

  async function handleDelete(id: string) {
    if (!confirm('Diesen Eintrag löschen?')) return;
    setDeleting(id);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/employee/experiences/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setHidden(h => new Set([...h, id])); refetch(); }
    } finally { setDeleting(null); }
  }

  const filtered = entries.filter(e => {
    if (hidden.has(e.id)) return false;
    const matchTab = tab==='all'||e.approval_status===tab||e.status===tab;
    const q = search.toLowerCase();
    return matchTab&&(!q||(e.title||'').toLowerCase().includes(q)||(e.category||'').toLowerCase().includes(q));
  });

  return (
    <EmployeeLayout title="Erlebnisse & Projekte">
      <PageHeader title="Erlebnisse & Projekte" subtitle="Live-Übersicht · Realtime" actionsRole="employee"/>
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {(['all','approved','pending','rejected'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'6px 14px',borderRadius:20,border:'1px solid var(--border)',background:tab===t?'var(--accent)':'transparent',color:tab===t?'#0f1117':'var(--text-muted)',fontWeight:600,fontSize:12,cursor:'pointer'}}>
            {t==='all'?'Alle':t==='approved'?'Genehmigt':t==='pending'?'Ausstehend':'Abgelehnt'}
          </button>
        ))}
        <input type="text" placeholder="Titel…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginLeft:'auto',padding:'6px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:12,minWidth:180}}/>
        <button onClick={refetch} style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:14}}>↻</button>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10}}>🟢 Realtime aktiv · {filtered.length} Einträge</div>
      {loading?<div style={{color:'var(--text-muted)',padding:40,textAlign:'center'}}>Laden…</div>:(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
              {['Quelle','Titel','Kategorie','Preis','Status','Erstellt',''].map(h=>(
                <th key={h} style={{padding:'8px 12px',textAlign:'left',color:'var(--text-muted)',fontWeight:600,fontSize:11}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(e=>(
                <tr key={e.id} style={{borderBottom:'1px solid var(--border)'}}
                    onMouseEnter={ev=>(ev.currentTarget.style.background='var(--bg-hover)')}
                    onMouseLeave={ev=>(ev.currentTarget.style.background='transparent')}>
                  <td style={{padding:'10px 12px'}}><Badge variant={e._source==='experiences'?'neutral':'success'}>{e._source==='experiences'?'Erlebnis':'Projekt'}</Badge></td>
                  <td style={{padding:'10px 12px',color:'var(--text-primary)',fontWeight:500}}>{e.title||'—'}</td>
                  <td style={{padding:'10px 12px',color:'var(--text-muted)'}}>{e.category||'—'}</td>
                  <td style={{padding:'10px 12px',color:'var(--text-muted)'}}>{fmtPrice(e.price)}</td>
                  <td style={{padding:'10px 12px'}}><Badge variant={STATUS_VARIANT[e.approval_status||e.status||'']??'neutral'}>{e.approval_status==='approved'?'Genehmigt':e.approval_status==='pending'?'Ausstehend':e.approval_status==='rejected'?'Abgelehnt':e.status||'—'}</Badge></td>
                  <td style={{padding:'10px 12px',color:'var(--text-muted)',fontSize:12}}>{timeAgo(e.created_at)}</td>
                  <td style={{padding:'10px 12px'}}>
                    <button onClick={()=>handleDelete(e.id)} disabled={deleting===e.id} style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--red-dim,#ff6b6b44)',background:'transparent',color:'var(--red,#ff6b6b)',fontSize:11,cursor:'pointer',opacity:deleting===e.id?0.5:1}}>
                      {deleting===e.id?'…':'Löschen'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Keine Einträge gefunden.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
