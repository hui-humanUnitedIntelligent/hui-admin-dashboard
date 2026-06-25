// frontend/src/app/employee/memberships/page.tsx
// READ-ONLY Employee-Ansicht: Mitgliedschaften
'use client';
import { useCallback, useEffect, useState } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { useMemberships } from '@/lib/hooks/useSupabase';

function timeAgo(iso?: string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'Heute';
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d/7)}w`;
  return `${Math.floor(d/30)}mo`;
}
function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function EmployeeMembershipsPage() {
  const { memberships, loading } = useMemberships({ limit: 500 });
  const [search, setSearch] = useState('');
  const [tab,    setTab]    = useState<'active'|'expired'|'all'>('active');

  const filtered = memberships.filter(m => {
    const matchTab = tab === 'all' ? true : tab === 'active' ? m.status === 'active' : m.status !== 'active';
    const q = search.toLowerCase();
    const matchSearch = !q || (m.membership_type || '').toLowerCase().includes(q) || (m.user_id || '').toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  return (
    <EmployeeLayout title="Mitgliedschaften">
      <PageHeader title="Mitgliedschaften" subtitle="Read-only Übersicht" actionsRole="employee" />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['active','expired','all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
            background: tab === t ? 'var(--accent)' : 'transparent',
            color: tab === t ? '#0f1117' : 'var(--text-muted)',
            fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>
            {t === 'active' ? 'Aktiv' : t === 'expired' ? 'Abgelaufen' : 'Alle'}
          </button>
        ))}
        <input type="text" placeholder="Typ oder User-ID…" value={search} onChange={e => setSearch(e.target.value)} style={{
          marginLeft: 'auto', padding: '6px 12px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
          color: 'var(--text-primary)', fontSize: 12, minWidth: 180,
        }} />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Laden…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Typ','Status','Gewicht','Start','Ablauf','Erstellt'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{m.membership_type || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <Badge variant={m.status === 'active' ? 'success' : 'neutral'}>{m.status || '—'}</Badge>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{m.vote_weight ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{fmtDate(m.started_at  ?? undefined)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{fmtDate(m.expires_at  ?? undefined)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{timeAgo(m.started_at  ?? undefined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Keine Mitgliedschaften gefunden.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
