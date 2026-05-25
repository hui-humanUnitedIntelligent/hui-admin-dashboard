'use client';

import { useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/ui/KPICard';
import { statusToBadge } from '@/components/ui/Badge';
import {
  DUMMY_KPIS,
  DUMMY_GROWTH,
  DUMMY_TX_CHART,
  DUMMY_TRANSACTIONS,
  DUMMY_FEED,
} from '@/lib/dummy/data';

export default function DashboardPage() {
  const growthRef = useRef<HTMLCanvasElement>(null);
  const txRef    = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let growthChart: unknown;
    let txChart: unknown;

    const load = async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      if (growthRef.current) {
        growthChart = new Chart(growthRef.current, {
          type: 'line',
          data: {
            labels: DUMMY_GROWTH.labels,
            datasets: [
              {
                label: 'Neue User',
                data: DUMMY_GROWTH.newUsers,
                borderColor: '#4ECDC4',
                backgroundColor: 'rgba(78,205,196,0.08)',
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#4ECDC4',
                fill: true,
                tension: 0.4,
              },
              {
                label: 'Aktive User',
                data: DUMMY_GROWTH.activeUsers,
                borderColor: '#B197FC',
                backgroundColor: 'rgba(177,151,252,0.05)',
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#B197FC',
                borderDash: [4, 4],
                fill: true,
                tension: 0.4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#8892A4', font: { size: 10 } } },
              y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#8892A4', font: { size: 10 } } },
            },
          },
        });
      }

      if (txRef.current) {
        txChart = new Chart(txRef.current, {
          type: 'bar',
          data: {
            labels: DUMMY_TX_CHART.labels,
            datasets: [
              {
                label: 'Transaktionen',
                data: DUMMY_TX_CHART.values,
                backgroundColor: 'rgba(247,183,49,0.7)',
                borderRadius: 4,
                borderSkipped: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#8892A4', font: { size: 10 } } },
              y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#8892A4', font: { size: 10 } } },
            },
          },
        });
      }
    };

    load();
    return () => {
      (growthChart as { destroy?: () => void })?.destroy?.();
      (txChart as { destroy?: () => void })?.destroy?.();
    };
  }, []);

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
  };

  return (
    <DashboardLayout title="Dashboard Overview">
      {/* KPI-Karten */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KPICard label="Gesamt-User"   value="4.812"   delta="12.4%"  deltaPositive icon="👥" accentColor="#4ECDC4" accentDim="rgba(78,205,196,0.12)" />
        <KPICard label="Umsatz (Monat)" value="€28.6K" delta="8.1%"   deltaPositive icon="€"  accentColor="#F7B731" accentDim="rgba(247,183,49,0.12)" />
        <KPICard label="Impact Pool"   value="€9.247"  delta="23.7%"  deltaPositive icon="🌱" accentColor="#74C0FC" accentDim="rgba(116,192,252,0.12)" />
        <KPICard label="Aktive Talente" value="1.347"  delta="3.2%"   deltaPositive={false} icon="⭐" accentColor="#B197FC" accentDim="rgba(177,151,252,0.12)" />
      </div>

      {/* Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>User-Wachstum</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Letzte 12 Monate</div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 2, background: '#4ECDC4', display: 'inline-block', borderRadius: 1 }} />
                Neu
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 0, borderTop: '2px dashed #B197FC', display: 'inline-block' }} />
                Aktiv
              </span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 160 }}>
            <canvas ref={growthRef} />
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Transaktionen</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Letzte 7 Tage</div>
          </div>
          <div style={{ position: 'relative', height: 160 }}>
            <canvas ref={txRef} />
          </div>
        </div>
      </div>

      {/* Letzte Transaktionen + Aktivitätsfeed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
        {/* Transaktionen */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>
            Letzte Transaktionen
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['User', 'Betrag', 'Status', 'Datum'].map((h) => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DUMMY_TRANSACTIONS.slice(0, 5).map((tx) => (
                <tr key={tx.id}>
                  <td style={{ padding: '9px 10px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>{tx.userName}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--accent)', fontFamily: 'Space Mono, monospace', fontSize: 11, borderBottom: '1px solid var(--border)' }}>€{tx.amount.toFixed(2)}</td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>{statusToBadge(tx.status)}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{tx.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Aktivitätsfeed */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>
            Aktivitätsfeed
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DUMMY_FEED.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: item.color,
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {item.text}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
