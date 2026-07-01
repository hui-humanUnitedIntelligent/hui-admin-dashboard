// frontend/src/app/dashboard/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import RefreshBtn from '@/components/dashboard/RefreshBtn';
import KPICard from '@/components/ui/KPICard';
import { statusToBadge } from '@/components/ui/Badge';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { useAuth } from '@/lib/hooks/useAuth';

function fmtEur(n: number) {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}K`;
  return `€${n.toFixed(0)}`;
}
function fmtNum(n: number) { return n.toLocaleString('de-DE'); }
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12, padding: 16,
};

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const db = useDashboard(30000); // alle 30s live-refresh

  const growthRef      = useRef<HTMLCanvasElement>(null);
  const txRef          = useRef<HTMLCanvasElement>(null);
  const growthChartRef = useRef<unknown>(null);
  const txChartRef     = useRef<unknown>(null);

  // ── Growth Chart ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!db.growth.labels.length) return;
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (!growthRef.current) return;
      if (growthChartRef.current) (growthChartRef.current as { destroy: () => void }).destroy();
      growthChartRef.current = new Chart(growthRef.current, {
        type: 'line',
        data: {
          labels: db.growth.labels,
          datasets: [
            {
              label: 'Neue User',
              data: db.growth.newUsers,
              borderColor: '#4ECDC4',
              backgroundColor: 'rgba(78,205,196,0.08)',
              borderWidth: 2, pointRadius: 3,
              pointBackgroundColor: '#4ECDC4',
              fill: true, tension: 0.4,
            },
            {
              label: 'Gesamt',
              data: db.growth.activeUsers,
              borderColor: '#B197FC',
              backgroundColor: 'rgba(177,151,252,0.04)',
              borderWidth: 2, pointRadius: 2,
              pointBackgroundColor: '#B197FC',
              borderDash: [4, 4],
              fill: false, tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(128,128,128,.06)' }, ticks: { color: '#8892A4', font: { size: 10 } } },
            y: { grid: { color: 'rgba(128,128,128,.06)' }, ticks: { color: '#8892A4', font: { size: 10 } } },
          },
        },
      });
    })();
  }, [db.growth.labels.join(',')]);

  // ── TX Chart ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!db.recentPayments.length) return;
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      const days: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days[d.toLocaleDateString('de-DE', { weekday: 'short' })] = 0;
      }
      db.recentPayments.forEach((p) => {
        const key = new Date(String(p.created_at)).toLocaleDateString('de-DE', { weekday: 'short' });
        if (key in days) days[key] += 1;
      });
      if (!txRef.current) return;
      if (txChartRef.current) (txChartRef.current as { destroy: () => void }).destroy();
      txChartRef.current = new Chart(txRef.current, {
        type: 'bar',
        data: {
          labels: Object.keys(days),
          datasets: [{ label: 'Zahlungen', data: Object.values(days),
            backgroundColor: 'rgba(247,183,49,0.65)', borderRadius: 4, borderSkipped: false }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#8892A4', font: { size: 10 } } },
            y: { grid: { color: 'rgba(128,128,128,.06)' }, ticks: { color: '#8892A4', font: { size: 10 } } },
          },
        },
      });
    })();
  }, [db.recentPayments.map(p => p.id).join(',')]);

  const { kpis } = db;

  return (
    <DashboardLayout
      title="Dashboard"
      headerActions={<RefreshBtn onClick={db.refetch} loading={db.loading} />}
    >
      <PageHeader
        title="Dashboard"
        subtitle={db.loading ? 'Lade…' : `Live · Zuletzt aktualisiert ${db.lastUpdated ? timeAgo(db.lastUpdated.toISOString()) : '—'}`}
        actionsRole="superadmin"
        userRole={currentUser?.role}
      />

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }} className="grid-4">
        <KPICard label="Gesamt-User"       value={db.loading ? '—' : fmtNum(kpis.totalUsers)}         delta={`${kpis.activeWirker} Wirker`}              deltaPositive icon="👥" variant="teal" />
        <KPICard label="Umsatz (Monat)"    value={db.loading ? '—' : fmtEur(kpis.monthlyRevenue)}     delta={`${kpis.totalPayments} Zahlungen`}           deltaPositive icon="€"  variant="gold" />
        <KPICard label="Projekt-Anteil"    value={db.loading ? '—' : fmtEur(kpis.projectShareEur)} delta="15 % des Pools"                              deltaPositive icon="🌱" variant="green" />
        <KPICard label="Firmenanteil"      value={db.loading ? '—' : fmtEur(kpis.companyShareEur)} delta="85 % des Pools"                                 deltaPositive icon="🏢" variant="blue" />
        <KPICard label="Aktive Mitglieder" value={db.loading ? '—' : fmtNum(kpis.activeMembers)}      delta={`${kpis.activeBookings} Buchungen aktiv`}    deltaPositive icon="🏅" variant="purple" />
        <KPICard label="Ambassadors aktiv" value={db.loading ? '—' : fmtNum(kpis.activeAmbassadors)}  delta={kpis.pendingAmbassadors > 0 ? `${kpis.pendingAmbassadors} Antrag offen` : 'Keine offen'} deltaPositive={kpis.pendingAmbassadors === 0} icon="🤝" variant="teal" />
        <KPICard label="Offene Anträge"    value={db.loading ? '—' : fmtNum(kpis.pendingAmbassadors)} delta={`${kpis.totalReferrals} Referrals`}          deltaPositive icon="📋" variant="red" />
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginBottom: 18 }} className="grid-2-1">
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>User-Wachstum</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Letzte 12 Monate · {db.loading ? 'Lade…' : 'Live'}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center', color: '#4ECDC4' }}><span style={{ width: 18, height: 2, background: '#4ECDC4', display: 'inline-block', borderRadius: 1 }} /> Neu</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center', color: '#B197FC' }}><span style={{ width: 18, height: 2, background: '#B197FC', display: 'inline-block', borderRadius: 1, opacity: 0.6 }} /> Gesamt</span>
            </div>
          </div>
          <div style={{ height: 160 }}><canvas ref={growthRef} /></div>
        </div>

        <div style={card}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Zahlungen</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Letzte 7 Tage · {db.loading ? 'Lade…' : 'Live'}</div>
          </div>
          <div style={{ height: 160 }}>
            {db.recentPayments.length > 0
              ? <canvas ref={txRef} />
              : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize: 12, color: 'var(--text-secondary)' }}>Keine Zahlungen</div>
            }
          </div>
        </div>
      </div>

      {/* ── Tables Row ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="grid-2">
        {/* Letzte Zahlungen */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Letzte Zahlungen</span>
            <a href="/transactions" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Alle →</a>
          </div>
          {db.loading ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Lade…</p>
          ) : db.recentPayments.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Keine Daten</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                  <th style={{ textAlign: 'left', padding: '0 0 8px', fontWeight: 500 }}>ID</th>
                  <th style={{ textAlign: 'right', padding: '0 0 8px', fontWeight: 500 }}>Betrag</th>
                  <th style={{ textAlign: 'center', padding: '0 0 8px', fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '0 0 8px', fontWeight: 500 }}>Datum</th>
                </tr>
              </thead>
              <tbody>
                {db.recentPayments.slice(0, 8).map((p) => (
                  <tr key={String(p.id)} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 0', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {String(p.id).slice(0, 8)}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 500 }}>
                      {fmtEur(Number(p.amount_eur) || 0)}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'center' }}>
                      {statusToBadge(String(p.status))}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {timeAgo(String(p.created_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Neue User */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Neue User</span>
            <a href="/users" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Alle →</a>
          </div>
          {db.loading ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Lade…</p>
          ) : db.recentUsers.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Keine neuen User</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {db.recentUsers.slice(0, 6).map((u) => (
                <div key={String(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    {u.avatar_url
                      ? <img src={String(u.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : String(u.display_name || u.username || 'U').charAt(0).toUpperCase()
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {String(u.display_name || u.username || u.email || '—')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {timeAgo(String(u.created_at))}
                      {u.is_wirker ? ' · Wirker' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
