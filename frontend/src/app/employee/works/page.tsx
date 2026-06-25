// frontend/src/app/employee/works/page.tsx
// READ-ONLY Employee-Ansicht: Werke & Content — REALTIME via useWorks()
'use client';
import { useState } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useWorks } from '@/lib/hooks/useSupabase';

const STATUS_VARIANT: Record<string, 'success'|'warning'|'danger'|'neutral'> = {
  published: 'success', draft: 'warning', deleted: 'danger',
};

function fmtPrice(n: number | null | undefined) {
  if (!n) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'Heute'; if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d/7)}w`; return `${Math.floor(d/30)}mo`;
}

export default function EmployeeWorksPage() {
  const { works, loading, refetch } = useWorks({ limit: 500 });
  const [search, setSearch] = useState('');
  const [tab,    setTab]    = useState<'published'|'draft'|'all'>('published');

  const filtered = works.filter(w => {
    const matchTab = tab === 'all' ? true : w.status === tab;
    const q = search.toLowerCase();
    return matchTab && (!q || (w.title||'').toLowerCase().includes(q) || (w.category||'').toLowerCase().includes(q))
      && w.status !== 'deleted';
  });

  return (
    <EmployeeLayout title="Werke & Content">
      <PageHeader title="Werke & Content" subtitle="Live-Übersicht · Realtime" actionsRole="employee" />

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {(['published','draft','all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'6px 14px', borderRadius:20, border:'1px solid var(--border)',
            background: tab===t ? 'var(--accent)' : 'transparent',
            color: tab===t ? '#0f1117' : 'var(--text-muted)',
            fontWeight:600, fontSize:12, cursor:'pointer',
          }}>
            {t==='published' ? 'Veröffentlicht' : t==='draft' ? 'Entwürfe' : 'Alle'}
          </button>
        ))}
        <input type="text" placeholder="Titel oder Kategorie…" value={search}
          onChange={e => setSearch(e.target.value)} style={{
            marginLeft:'auto', padding:'6px 12px', borderRadius:8,
            border:'1px solid var(--border)', background:'var(--bg-secondary)',
            color:'var(--text-primary)', fontSize:12, minWidth:180,
          }} />
        <button onClick={refetch} title="Aktualisieren" style={{
          padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)',
          background:'transparent', color:'var(--text-muted)', cursor:'pointer', fontSize:14,
        }}>↻</button>
      </div>

      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>
        🟢 Realtime aktiv · {filtered.length} Einträge
      </div>

      {loading ? (
        <div style={{ color:'var(--text-muted)', padding:40, textAlign:'center' }}>Laden…</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['Vorschau','Titel','Kategorie','Preis','Status','Erstellt'].map(h => (
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-muted)', fontWeight:600, fontSize:11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(w => (
                <tr key={w.id} style={{ borderBottom:'1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background='var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <td style={{ padding:'10px 12px' }}>
                    {w.thumbnail_url ? (
                      <img src={w.thumbnail_url} alt="" style={{ width:40, height:40, objectFit:'cover', borderRadius:6, display:'block' }} />
                    ) : (
                      <div style={{ width:40, height:40, borderRadius:6, background:'var(--bg-tertiary)',
                        display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:16 }}>🖼️</div>
                    )}
                  </td>
                  <td style={{ padding:'10px 12px', color:'var(--text-primary)', fontWeight:500, maxWidth:200 }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.title||'—'}</div>
                  </td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)' }}>{w.category||'—'}</td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)' }}>{fmtPrice(w.price)}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <Badge variant={STATUS_VARIANT[w.status]??'neutral'}>
                      {w.status==='published' ? 'Veröffentlicht' : w.status==='draft' ? 'Entwurf' : w.status||'—'}
                    </Badge>
                  </td>
                  <td style={{ padding:'10px 12px', color:'var(--text-muted)', fontSize:12 }}>{timeAgo(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Keine Werke gefunden.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
