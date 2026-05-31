// frontend/src/app/dashboard/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/ui/KPICard';
import { statusToBadge } from '@/components/ui/Badge';
import { useKPIs, usePayments, useProfiles, useGrowthChart } from '@/lib/hooks/useSupabase';

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtEur(n: number) {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}K`;
  return `€${n.toFixed(0)}`;
}
function fmtNum(n: number) {
  return n.toLocaleString('de-DE');
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 16,
};

// ── Refresh Button ────────────────────────────────────────────────────────
function RefreshBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 11.5, color: 'var(--text-secondary)',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'var(--font-body)',
      }}
    >
      <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
      {loading ? 'Lade…' : 'Refresh'}
    </button>
  );
}

export default function DashboardPage() {
  const kpis     = useKPIs(30000);
  const { payments, loading: txLoading } = usePayments({ limit: 8, refreshInterval: 30000 });
  const { profiles: recentUsers } = useProfiles({ limit: 5, refreshInterval: 30000 });
  const growth   = useGrowthChart();

  const growthRef = useRef<HTMLCanvasElement>(null);
  const txRef     = useRef<HTMLCanvasElement>(null);
  const growthChartRef = useRef<unknown>(null);
  const txChartRef     = useRef<unknown>(null);

  // ── Build charts ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!growth.labels.length) return;

    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      if (growthRef.current) {
        if (growthChartRef.current) (growthChartRef.current as { destroy: () => void }).destroy();
        growthChartRef.current = new Chart(growthRef.current, {
          type: 'line',
          data: {
            labels: growth.labels,
            datasets: [
              {
                label: 'Neue User',
                data: growth.newUsers,
                borderColor: '#4ECDC4',
                backgroundColor: 'rgba(78,205,196,0.08)',
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#4ECDC4',
                fill: true,
                tension: 0.4,
              },
              {
                label: 'Gesamt',
                data: growth.activeUsers,
                borderColor: '#B197FC',
                backgroundColor: 'rgba(177,151,252,0.04)',
                borderWidth: 2,
                pointRadius: 2,
                pointBackgroundColor: '#B197FC',
                borderDash: [4, 4],
                fill: false,
                tension: 0.4,
              },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,.03)' }, ticks: { color: '#8892A4', font: { size: 10 } } },
              y: { grid: { color: 'rgba(255,255,255,.03)' }, ticks: { color: '#8892A4', font: { size: 10 } } },
            },
          },
        });
      }
    })();
  }, [growth.labels.join(',')]);

  // ── Tx chart from payments ─────────────────────────────────────────────
  useEffect(() => {
    if (!payments.length) return;

    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      // Group by last 7 days
      const days: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('de-DE', { weekday: 'short' });
        days[key] = 0;
      }
      payments.forEach((p) => {
        const key = new Date(p.created_at).toLocaleDateString('de-DE', { weekday: 'short' });
        if (key in days) days[key] += 1;
      });

      if (txRef.current) {
        if (txChartRef.current) (txChartRef.current as { destroy: () => void }).destroy();
        txChartRef.current = new Chart(txRef.current, {
          type: 'bar',
          data: {
            labels: Object.keys(days),
            datasets: [{
              label: 'Transaktionen',
              data: Object.values(days),
              backgroundColor: 'rgba(247,183,49,0.65)',
              borderRadius: 4,
              borderSkipped: false,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#8892A4', font: { size: 10 } } },
              y: { grid: { color: 'rgba(255,255,255,.03)' }, ticks: { color: '#8892A4', font: { size: 10 } } },
            },
          },
        });
      }
    })();
  }, [payments.map((p) => p.id).join(',')]);

  return (
    <DashboardLayout
      title="Dashboard"
      headerActions={
        <RefreshBtn onClick={kpis.refetch} loading={kpis.loading} />
      }
    >
      {/* ── KPI Row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12, marginBottom: 18,
        }}
        className="grid-4"
      >
        <KPICard
          label="Gesamt-User"
          value={kpis.loading ? '—' : fmtNum(kpis.totalUsers)}
          delta={kpis.loading ? '' : `${kpis.activeWirker} Wirker`}
          deltaPositive
          icon="👥"
          accentColor="#4ECDC4"
          accentDim="rgba(78,205,196,0.12)"
        />
        <KPICard
          label="Umsatz (Monat)"
          value={kpis.loading ? '—' : fmtEur(kpis.monthlyRevenue)}
          delta={kpis.loading ? '' : `${kpis.totalPayments} Zahlungen`}
          deltaPositive
          icon="€"
          accentColor="#F7B731"
          accentDim="rgba(247,183,49,0.12)"
        />
        <KPICard
          label="Netto Impact Pool"
          value={kpis.loading ? '—' : fmtEur(kpis.impactPool * 0.85)}
          delta="85 % der 15 %"
          deltaPositive
          icon="🌱"
          accentColor="#4ECDC4"
          accentDim="rgba(78,205,196,0.12)"
        />
        <KPICard
          label="Firmenanteil"
          value={kpis.loading ? '—' : fmtEur(kpis.impactPool * 0.15)}
          delta="15 % der 15 %"
          deltaPositive
          icon="🏢"
          accentColor="#F7B731"
          accentDim="rgba(247,183,49,0.12)"
        />
        <KPICard
          label="Aktive Mitglieder"
          value={kpis.loading ? '—' : fmtNum(kpis.activeMembers)}
          delta={kpis.loading ? '' : `${kpis.activeBookings} Buchungen aktiv`}
          deltaPositive
          icon="🏅"
          accentColor="#B197FC"
          accentDim="rgba(177,151,252,0.12)"
        />
      </div>

      {/* ── Charts Row ── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginBottom: 18 }}
        className="grid-2-1"
      >
        {/* User Growth */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                User-Wachstum
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Letzte 12 Monate · {growth.loading ? 'Lade…' : 'Live'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 2, background: '#4ECDC4', display: 'inline-block', borderRadius: 1 }} />
                Neu
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 0, borderTop: '2px dashed #B197FC', display: 'inline-block' }} />
                Gesamt
              </span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 160 }}>
            {growth.loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}>
                Lade Live-Daten…
              </div>
            ) : (
              <canvas ref={growthRef} />
            )}
          </div>
        </div>

        {/* Tx Chart */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Zahlungen
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Letzte 7 Tage · Live</div>
          </div>
          <div style={{ position: 'relative', height: 160 }}>
            {txLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}>
                Lade…
              </div>
            ) : (
              <canvas ref={txRef} />
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Transactions + Recent Users ── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}
        className="grid-2-1"
      >
        {/* Latest Payments */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Letzte Zahlungen
            </div>
            <a href="/transactions" style={{ fontSize: 11, color: 'var(--accent)' }}>
              Alle →
            </a>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['ID', 'Betrag', 'Status', 'Datum'].map((h) => (
                    <th key={h} style={{
                      padding: '8px 14px', textAlign: 'left',
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.8px',
                      textTransform: 'uppercase', color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      Lade…
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      Keine Daten
                    </td>
                  </tr>
                ) : (
                  payments.slice(0, 6).map((p) => (
                    <tr key={p.id} className="tr-hover">
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>
                        {p.id.slice(0, 8)}…
                      </td>
                      <td style={{ padding: '9px 14px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                        €{(p.amount_eur || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                        {statusToBadge(p.status)}
                      </td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                        {timeAgo(p.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Users */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Neue User
            </div>
            <a href="/users" style={{ fontSize: 11, color: 'var(--accent)' }}>
              Alle →
            </a>
          </div>
          <div>
            {recentUsers.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Lade…
              </div>
            ) : (
              recentUsers.map((u) => (
                <a
                  key={u.id}
                  href={`/users?id=${u.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border)',
                    textDecoration: 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: u.is_wirker ? 'var(--purple)' : 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, color: '#0F1117', flexShrink: 0,
                    }}
                  >
                    {(u.display_name || u.username || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.display_name || u.username || 'Unbekannt'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {u.is_wirker ? '⭐ Wirker' : '👤 User'} · {timeAgo(u.created_at)}
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
