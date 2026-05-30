// frontend/src/app/works/page.tsx
'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { statusToBadge } from '@/components/ui/Badge';
import { useWorks } from '@/lib/hooks/useSupabase';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  return `Vor ${days}d`;
}

function Skeleton() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: '60%' }} />
        </td>
      ))}
    </tr>
  );
}

export default function WorksPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { works, total, loading, refetch } = useWorks({ status: statusFilter, limit: 100, refreshInterval: 30000 });

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  });

  return (
    <DashboardLayout title="Works & Content" headerActions={
      <button onClick={refetch} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻ Refresh</button>
    }>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }} className="grid-4">
        {[
          { label: 'Works total',    value: loading ? '…' : String(total), color: 'var(--accent)' },
          { label: 'Published',      value: loading ? '…' : String(works.filter(w=>w.status==='published').length), color: 'var(--green)' },
          { label: 'Likes gesamt',   value: loading ? '…' : works.reduce((s,w)=>s+(w.likes_count||0),0).toLocaleString('de-DE'), color: 'var(--red)' },
          { label: 'Views gesamt',   value: loading ? '…' : works.reduce((s,w)=>s+(w.views_count||0),0).toLocaleString('de-DE'), color: 'var(--purple)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['all','published','draft','archived'].map((s) => (
          <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'Alle' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Titel', 'Kategorie', 'Status', 'Preis', 'Likes', 'Views', 'Erstellt'].map((h) => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton /><Skeleton /><Skeleton /><Skeleton /></>
              ) : works.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Keine Works</td></tr>
              ) : works.map((w) => (
                <tr key={w.id} className="tr-hover">
                  <td style={{ padding: '9px 14px', color: 'var(--text-primary)', fontWeight: 500, borderBottom: '1px solid var(--border)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{w.category || '—'}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>{statusToBadge(w.status)}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{w.price ? `€${w.price.toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>♥ {w.likes_count||0}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>👁 {w.views_count||0}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{timeAgo(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
