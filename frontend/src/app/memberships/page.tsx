// frontend/src/app/memberships/page.tsx
// Superadmin: Mitgliedschaften — mit Gelöscht-Tab + Endgültig-löschen
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useMemberships } from '@/lib/hooks/useSupabase';
import { getSessionToken } from '@/lib/session';

function timeAgo(iso: string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 1) return 'Heute'; return `Vor ${d}d`;
}
function Skeleton() {
  return <tr>{[...Array(6)].map((_,i) => (
    <td key={i} style={{ padding:'11px 14px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ height:11, background:'var(--bg-tertiary)', borderRadius:4, width:'60%' }}/>
    </td>
  ))}</tr>;
}

type TabKey = 'active' | 'all' | 'deleted';

export default function MembershipsPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const userRole = currentUser?.role;

  useEffect(() => {
    if (currentUser && !isSuperAdmin(currentUser.role)) router.replace('/employee/memberships');
  }, [currentUser, router]);

  const { memberships, total, loading, refetch } = useMemberships({ limit: 500 });
  const [tab, setTab] = useState<TabKey>('active');
  const [deletingId, setDeletingId] = useState<string|null>(null);
  const [toast, setToast] = useState('');

  const filtered = memberships.filter(m => {
    if (tab === 'deleted') return m.status === 'deleted';
    if (tab === 'active')  return m.status === 'active';
    return true;
  });

  const byType = memberships.filter(m=>m.status!=='deleted').reduce<Record<string,number>>((a,m)=>{
    a[m.membership_type]=(a[m.membership_type]||0)+1; return a;
  },{});

  async function handleHardDelete(id: string) {
    if (!confirm('⚠️ Endgültig löschen? Diese Aktion ist irreversibel!')) return;
    setDeletingId(id);
    try {
      const token = await getSessionToken();
      const res = await fetch(`/api/admin/memberships/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { setToast('Endgültig gelöscht.'); refetch(); }
      else setToast('Fehler beim Löschen');
    } catch { setToast('Fehler'); }
    finally { setDeletingId(null); setTimeout(()=>setToast(''),3000); }
  }

  const tabStyle = (t: TabKey) => ({
    padding:'6px 16px', borderRadius:20, border:'1px solid var(--border)',
    background: tab===t ? 'var(--accent)' : 'transparent',
    color: tab===t ? '#0f1117' : 'var(--text-muted)',
    fontWeight:600, fontSize:12, cursor:'pointer',
  } as React.CSSProperties);

  return (
    <DashboardLayout title="Mitgliedschaften" headerActions={
      <button onClick={refetch} style={{padding:'5px 12px',background:'var(--bg-tertiary)',border:'1px solid var(--border)',borderRadius:8,fontSize:11,color:'var(--text-secondary)',cursor:'pointer'}}>↻ Refresh</button>
    }>
      <PageHeader title="Mitgliedschaften" subtitle="Mitgliedschaftsstatus verwalten" actionsRole="admin" userRole={userRole}/>

      {toast && <div style={{padding:'8px 16px',background:'var(--bg-secondary)',borderRadius:8,marginBottom:12,fontSize:12,color:'var(--text-primary)'}}>{toast}</div>}

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:18}} className="grid-4">
        <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
          <div style={{fontSize:22,fontWeight:700,color:'var(--accent)',fontFamily:'var(--font-mono)'}}>{loading?'…':total}</div>
          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginTop:4}}>Aktive Mitglieder</div>
        </div>
        {Object.entries(byType).slice(0,3).map(([type,count])=>(
          <div key={type} style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:22,fontWeight:700,color:'var(--purple)',fontFamily:'var(--font-mono)'}}>{count}</div>
            <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginTop:4}}>{type}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button style={tabStyle('active')}  onClick={()=>setTab('active')}>Aktiv</button>
        <button style={tabStyle('all')}     onClick={()=>setTab('all')}>Alle</button>
        <button style={tabStyle('deleted')} onClick={()=>setTab('deleted')}>🗑 Gelöscht</button>
      </div>

      <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>
              {['ID','User ID','Typ','Gewicht','Status','Gestartet', tab==='deleted'?'Aktion':'Ablauf'].map(h=>(
                <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontWeight:600,letterSpacing:'0.8px',textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <><Skeleton/><Skeleton/><Skeleton/></> :
               filtered.length===0 ? <tr><td colSpan={7} style={{padding:30,textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Keine Einträge</td></tr> :
               filtered.map(m=>(
                <tr key={m.id} className="tr-hover">
                  <td style={{padding:'9px 14px',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>{m.id.slice(0,8)}…</td>
                  <td style={{padding:'9px 14px',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-secondary)',borderBottom:'1px solid var(--border)'}}>{m.user_id.slice(0,8)}…</td>
                  <td style={{padding:'9px 14px',borderBottom:'1px solid var(--border)'}}>
                    <Badge variant={m.membership_type==='free'?'neutral':m.membership_type==='wirker'?'purple':'info'}>{m.membership_type}</Badge>
                  </td>
                  <td style={{padding:'9px 14px',fontFamily:'var(--font-mono)',color:'var(--accent)',borderBottom:'1px solid var(--border)'}}>{m.vote_weight}x</td>
                  <td style={{padding:'9px 14px',borderBottom:'1px solid var(--border)'}}>
                    <Badge variant={m.status==='active'?'success':m.status==='deleted'?'danger':'neutral'}>{m.status}</Badge>
                  </td>
                  <td style={{padding:'9px 14px',color:'var(--text-muted)',fontSize:11,borderBottom:'1px solid var(--border)'}}>{timeAgo(m.started_at)}</td>
                  <td style={{padding:'9px 14px',borderBottom:'1px solid var(--border)'}}>
                    {tab==='deleted' ? (
                      <button onClick={()=>handleHardDelete(m.id)} disabled={deletingId===m.id} style={{
                        padding:'4px 10px',borderRadius:6,border:'1px solid var(--red)',
                        background:'var(--red-dim,rgba(255,107,107,0.1))',color:'var(--red,#ff6b6b)',
                        fontSize:11,cursor:'pointer',fontWeight:600,opacity:deletingId===m.id?0.5:1,
                      }}>{deletingId===m.id?'…':'⚠ Endgültig löschen'}</button>
                    ) : (
                      <span style={{color:m.expires_at?'var(--gold)':'var(--text-muted)',fontSize:11}}>
                        {m.expires_at ? new Date(m.expires_at).toLocaleDateString('de-DE') : '∞'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
