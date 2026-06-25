// frontend/src/app/employee/reasons/page.tsx
// READ-ONLY Employee-Ansicht: Ablehnungsgründe — REALTIME via useScoreFailures()
'use client';
import { useState } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useScoreFailures } from '@/lib/hooks/useSupabase';

function fmtEur(n: number | null | undefined) {
  if (!n) return '—';
  return new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(n);
}
function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d===0) return 'Heute'; if (d<7) return `${d}d`;
  if (d<30) return `${Math.floor(d/7)}w`; return `${Math.floor(d/30)}mo`;
}
function scoreVariant(score: number): 'danger'|'warning'|'neutral' {
  if (score<40) return 'danger'; if (score<60) return 'warning'; return 'neutral';
}

export default function EmployeeReasonsPage() {
  const { failures, loading, refetch } = useScoreFailures({ limit: 200 });
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<string|null>(null);

  const filtered = failures.filter(i => {
    const q = search.toLowerCase();
    return !q || (i.project_name||'').toLowerCase().includes(q)
              || (i.kategorie||'').toLowerCase().includes(q)
              || (i.grund||'').toLowerCase().includes(q);
  });

  return (
    <EmployeeLayout title="Ablehnungsgründe">
      <PageHeader title="Ablehnungsgründe" subtitle="Live-Übersicht · Realtime" actionsRole="employee" />

      <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
        <input type="text" placeholder="Projektname, Kategorie oder Grund…" value={search}
          onChange={e => setSearch(e.target.value)} style={{
            flex:1, maxWidth:400, padding:'8px 12px', borderRadius:8,
            border:'1px solid var(--border)', background:'var(--bg-secondary)',
            color:'var(--text-primary)', fontSize:13,
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
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(item => (
            <div key={item.id}
              onClick={() => setSelected(selected===item.id ? null : item.id)}
              style={{
                background:'var(--bg-secondary)', border:'1px solid var(--border)',
                borderRadius:10, padding:'14px 18px', cursor:'pointer',
                borderColor: selected===item.id ? 'var(--accent)' : 'var(--border)',
                transition:'border-color 0.15s',
              }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, color:'var(--text-primary)', fontSize:13 }}>{item.project_name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                    {item.kategorie||'—'} · {fmtEur(item.funding_goal)} · {timeAgo(item.created_at)}
                  </div>
                </div>
                <Badge variant={scoreVariant(item.ai_score)}>Score: {item.ai_score}</Badge>
              </div>
              {selected===item.id && (
                <div style={{
                  marginTop:10, padding:'10px 14px', borderRadius:8,
                  background:'var(--bg-primary)', border:'1px solid var(--border)',
                  fontSize:13, color:'var(--text-secondary)', lineHeight:1.6,
                }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Ablehnungsgrund:</div>
                  {item.grund||'—'}
                  {item.short_desc && (
                    <div style={{ marginTop:8, fontSize:12, color:'var(--text-muted)' }}>{item.short_desc}</div>
                  )}
                </div>
              )}
            </div>
          ))}
          {filtered.length===0 && <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Keine Ablehnungsgründe gefunden.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
