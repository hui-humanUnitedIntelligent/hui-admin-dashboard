// frontend/src/app/memberships/page.tsx
'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import Badge from '@/components/ui/Badge';
import { useMemberships } from '@/lib/hooks/useSupabase';

function timeAgo(iso: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Heute';
  return `Vor ${days} Tagen`;
}

function Skeleton() {
  return (
    <tr>
      {[...Array(5)].map((_, i) => (
        <td key={i} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: '60%' }} />
        </td>
      ))}
    </tr>
  );
}

export default function MembershipsPage() {
  const { memberships, total, loading, refetch } = useMemberships({ limit: 200, refreshInterval: 60000 });

  const byType = memberships.reduce<Record<string, number>>((acc, m) => {
    acc[m.membership_type] = (acc[m.membership_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardLayout title="Mitgliedschaften" headerActions={
      <button onClick={refetch} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻ Refresh</button>
    }>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }} className="grid-4">
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{loading ? '…' : total}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>Aktive Mitglieder</div>
        </div>
        {Object.entries(byType).slice(0, 3).map(([type, count]) => (
          <div key={type} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--purple)', fontFamily: 'var(--font-mono)' }}>{count}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{type}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Membership ID', 'User ID', 'Typ', 'Vote-Gewicht', 'Status', 'Gestartet', 'Läuft ab'].map((h) => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton /><Skeleton /><Skeleton /></>
              ) : memberships.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Keine Mitgliedschaften</td></tr>
              ) : memberships.map((m) => (
                <tr key={m.id} className="tr-hover">
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{m.id.slice(0,8)}…</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{m.user_id.slice(0,8)}…</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                    <Badge variant={m.membership_type === 'free' ? 'neutral' : m.membership_type === 'wirker' ? 'purple' : 'info'}>{m.membership_type}</Badge>
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}>{m.vote_weight}x</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                    <Badge variant="success">{m.status}</Badge>
                  </td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{timeAgo(m.started_at)}</td>
                  <td style={{ padding: '9px 14px', color: m.expires_at ? 'var(--gold)' : 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{m.expires_at ? new Date(m.expires_at).toLocaleDateString('de-DE') : '∞ Unbegrenzt'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
