// frontend/src/app/employee/memberships/page.tsx
// Employee: Mitgliedschaften — Realtime + Soft-Delete
'use client';
import { useState } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useMemberships } from '@/lib/hooks/useSupabase';
import { getSessionToken } from '@/lib/session';

function fmtDate(iso:string|null|undefined){if(!iso)return'—';return new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});}
function timeAgo(iso:string|null|undefined){if(!iso)return'—';const d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);if(d===0)return'Heute';if(d<7)return`${d}d`;if(d<30)return`${Math.floor(d/7)}w`;return`${Math.floor(d/30)}mo`;}

export default function EmployeeMembershipsPage() {
  const { memberships, loading, refetch } = useMemberships({ limit: 500 });
  const [search, setSearch] = useState('');
  const [tab,    setTab]    = useState<'active'|'expired'|'all'>('active');
  const [deleting, setDeleting] = useState<string|null>(null);
  const [hidden,   setHidden]   = useState<Set<string>>(new Set());

  async function handleDelete(id: string) {
    if (!confirm('Diese Mitgliedschaft löschen?')) return;
    setDeleting(id);
    try {
      const token = await getSessionToken();
      const res = await fetch('/api/employee/memberships/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setHidden(h => new Set([...h, id])); refetch(); }
    } finally { setDeleting(null); }
  }

  const filtered = memberships.filter(m => {
    if (hidden.has(m.id) || m.status==='deleted') return false;
    const matchTab = tab==='all'?true:tab==='active'?m.status==='active':m.status!=='active';
    const q = search.toLowerCase();
    return matchTab&&(!q||(m.membership_type||'').toLowerCase().includes(q));
  });

  return (
    <EmployeeLayout title="Mitgliedschaften">
      <PageHeader title="Mitgliedschaften" subtitle="Live-Übersicht · Realtime" actionsRole="employee"/>
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {(['active','expired','all'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'6px 14px',borderRadius:20,border:'1px solid var(--border)',background:tab===t?'var(--accent)':'transparent',color:tab===t?'#0f1117':'var(--text-muted)',fontWeight:600,fontSize:12,cursor:'pointer'}}>
            {t==='active'?'Aktiv':t==='expired'?'Abgelaufen':'Alle'}
          </button>
        ))}
        <input type="text" placeholder="Typ…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginLeft:'auto',padding:'6px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--text-primary)',fontSize:12,minWidth:180}}/>
        <button onClick={refetch} style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:14}}>↻</button>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10}}>🟢 Realtime aktiv · {filtered.length} Mitgliedschaften</div>
      {loading?<div style={{color:'var(--text-muted)',padding:40,textAlign:'center'}}>Laden…</div>:(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
              {['Typ','Status','Gewicht','Start','Ablauf','Erstellt',''].map(h=>(
                <th key={h} style={{padding:'8px 12px',textAlign:'left',color:'var(--text-muted)',fontWeight:600,fontSize:11}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(m=>(
                <tr key={m.id} style={{borderBottom:'1px solid var(--border)'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-hover)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <td style={{padding:'10px 12px',color:'var(--text-primary)',fontWeight:500}}>{m.membership_type||'—'}</td>
                  <td style={{padding:'10px 12px'}}><Badge variant={m.status==='active'?'success':'neutral'}>{m.status||'—'}</Badge></td>
                  <td style={{padding:'10px 12px',color:'var(--text-muted)'}}>{m.vote_weight??'—'}</td>
                  <td style={{padding:'10px 12px',color:'var(--text-muted)',fontSize:12}}>{fmtDate(m.started_at??undefined)}</td>
                  <td style={{padding:'10px 12px',color:'var(--text-muted)',fontSize:12}}>{fmtDate(m.expires_at??undefined)}</td>
                  <td style={{padding:'10px 12px',color:'var(--text-muted)',fontSize:12}}>{timeAgo(m.started_at??undefined)}</td>
                  <td style={{padding:'10px 12px'}}>
                    <button onClick={()=>handleDelete(m.id)} disabled={deleting===m.id} style={{padding:'4px 10px',borderRadius:6,border:'1px solid var(--red-dim,#ff6b6b44)',background:'transparent',color:'var(--red,#ff6b6b)',fontSize:11,cursor:'pointer',opacity:deleting===m.id?0.5:1}}>
                      {deleting===m.id?'…':'Löschen'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Keine Mitgliedschaften gefunden.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
