'use client';

import { useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/ui/KPICard';
import { DUMMY_IMPACT, DUMMY_PROJECTS } from '@/lib/dummy/data';

export default function ImpactPage() {
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chart: unknown;
    const load = async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (chartRef.current) {
        chart = new Chart(chartRef.current, {
          type: 'bar',
          data: {
            labels: DUMMY_IMPACT.history.labels,
            datasets: [
              { label: 'Einzahlungen', data: DUMMY_IMPACT.history.deposits,     backgroundColor: 'rgba(78,205,196,0.7)',  borderRadius: 4, borderSkipped: false },
              { label: 'Auszahlungen', data: DUMMY_IMPACT.history.withdrawals,  backgroundColor: 'rgba(255,107,107,0.5)', borderRadius: 4, borderSkipped: false },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#8892A4', font: { size: 10 } } },
              y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#8892A4', font: { size: 10 }, callback: (v) => `€${v}` } },
            },
          },
        });
      }
    };
    load();
    return () => (chart as { destroy?: () => void })?.destroy?.();
  }, []);

  return (
    <DashboardLayout title="Impact Pool">
      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg,rgba(78,205,196,.15),rgba(78,205,196,.05))',
          border: '1px solid rgba(78,205,196,.3)',
          borderRadius: 16,
          padding: '24px',
          textAlign: 'center',
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          🌱 Impact Pool — Gesamtstand
        </div>
        <div style={{ fontSize: 40, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Space Mono, monospace', letterSpacing: '-2px' }}>
          €{DUMMY_IMPACT.balance.toLocaleString('de-DE')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
          Stand: Mai 2025 · Dummy-Modus aktiv
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <KPICard label="Einzahlungen (Monat)"  value="€2.840" delta="18%"  deltaPositive icon="↓" accentColor="#4ECDC4" accentDim="rgba(78,205,196,0.12)" />
        <KPICard label="Auszahlungen (Monat)"  value="€1.120" delta="4%"   deltaPositive={false} icon="↑" accentColor="#F7B731" accentDim="rgba(247,183,49,0.12)" />
        <KPICard label="Projekte unterstützt"  value="14"     delta="3 neu" deltaPositive icon="🎯" accentColor="#74C0FC" accentDim="rgba(116,192,252,0.12)" />
      </div>

      {/* Chart + Projekte */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        {/* Chart */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Pool-Verlauf</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Letzte 6 Monate</div>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(78,205,196,0.7)', display: 'inline-block' }} /> Einzahlungen
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,107,107,0.5)', display: 'inline-block' }} /> Auszahlungen
              </span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 200 }}>
            <canvas ref={chartRef} />
          </div>
        </div>

        {/* Projekte */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>
            Unterstützte Projekte
          </div>
          <div>
            {DUMMY_PROJECTS.map((proj) => (
              <div
                key={proj.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${proj.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {proj.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{proj.name}</div>
                  <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${proj.progress}%`, background: proj.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{proj.progress}% Ziel erreicht</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--green)', fontFamily: 'Space Mono, monospace', flexShrink: 0 }}>
                  €{proj.amount.toLocaleString('de-DE')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
