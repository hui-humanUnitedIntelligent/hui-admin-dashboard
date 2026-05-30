// frontend/src/app/impact/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/ui/KPICard';
import { useImpactProjects, usePayments } from '@/lib/hooks/useSupabase';

function fmtEur(n: number) {
  return `€${n.toLocaleString('de-DE', { minimumFractionDigits: 0 })}`;
}

export default function ImpactPage() {
  const { projects, loading: projLoading, refetch } = useImpactProjects(30000);
  const { payments, loading: payLoading } = usePayments({ refreshInterval: 30000, limit: 500 });

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);

  // Aggregate impact stats from payments
  const totalImpact   = payments.reduce((s, p) => s + (p.impact_amount || 0), 0);
  const completedPay  = payments.filter((p) => p.status === 'completed');
  const monthImpact   = completedPay.reduce((s, p) => s + (p.impact_amount || 0), 0);
  const totalProjects = projects.length;
  const activeProj    = projects.filter((p) => p.status === 'active').length;

  // Build chart
  useEffect(() => {
    if (!projects.length) return;
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (chartRef.current) {
        if (chartInstance.current) (chartInstance.current as { destroy: () => void }).destroy();
        chartInstance.current = new Chart(chartRef.current, {
          type: 'doughnut',
          data: {
            labels: projects.slice(0, 6).map((p) => p.name),
            datasets: [{
              data: projects.slice(0, 6).map((p) => p.votes || 1),
              backgroundColor: projects.slice(0, 6).map((p) => p.color || '#4ECDC4'),
              borderWidth: 0,
              hoverOffset: 6,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: { color: '#8892A4', font: { size: 11 }, padding: 12 },
              },
            },
          },
        });
      }
    })();
  }, [projects.map((p) => p.id).join(',')]);

  return (
    <DashboardLayout
      title="Impact Pool"
      headerActions={
        <button onClick={refetch} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5 }}>
          ↻ Refresh
        </button>
      }
    >
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(78,205,196,.18), rgba(78,205,196,.05))',
        border: '1px solid rgba(78,205,196,.25)',
        borderRadius: 16, padding: '24px', textAlign: 'center', marginBottom: 18,
      }}>
        <div style={{ fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          🌱 Impact Pool — Live Stand
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-2px' }}>
          {payLoading ? '—' : fmtEur(totalImpact)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
          Aus {completedPay.length} abgeschlossenen Zahlungen · Live aus Supabase
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }} className="grid-4">
        <KPICard label="Impact (Monat)"     value={payLoading ? '—' : fmtEur(monthImpact)}  delta="Live"     deltaPositive icon="↓" accentColor="#4ECDC4" accentDim="rgba(78,205,196,0.12)" />
        <KPICard label="Projekte total"     value={projLoading ? '—' : String(totalProjects)} delta="gesamt"  deltaPositive icon="🎯" accentColor="#74C0FC" accentDim="rgba(116,192,252,0.12)" />
        <KPICard label="Aktive Projekte"    value={projLoading ? '—' : String(activeProj)}   delta="aktiv"   deltaPositive icon="✅" accentColor="#51CF66" accentDim="rgba(81,207,102,0.12)" />
        <KPICard label="Zahlungen (Impact)" value={payLoading ? '—' : String(completedPay.length)} delta="completed" deltaPositive icon="€" accentColor="#F7B731" accentDim="rgba(247,183,49,0.12)" />
      </div>

      {/* Chart + Projects */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, marginBottom: 18 }} className="grid-2-1">
        {/* Doughnut */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Votes-Verteilung</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>Top-Projekte nach Stimmen</div>
          <div style={{ position: 'relative', height: 200 }}>
            {projLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}>Lade…</div>
            ) : projects.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}>Keine Projekte</div>
            ) : (
              <canvas ref={chartRef} />
            )}
          </div>
        </div>

        {/* Project List */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Impact-Projekte</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalProjects} total</span>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {projLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Lade…</div>
            ) : projects.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Keine Projekte vorhanden</div>
            ) : (
              projects.map((proj) => {
                const goal = proj.goal_eur || 0;
                const awarded = proj.awarded_eur || 0;
                const pct = goal > 0 ? Math.min(100, Math.round((awarded / goal) * 100)) : 0;
                return (
                  <div key={proj.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: proj.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                        {proj.icon || '🎯'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {proj.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                          {proj.category || '—'} · {proj.votes || 0} Votes · {proj.status}
                        </div>
                      </div>
                      {goal > 0 && (
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', flexShrink: 0 }}>
                          {fmtEur(awarded)} / {fmtEur(goal)}
                        </div>
                      )}
                    </div>
                    {goal > 0 && (
                      <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: proj.color || 'var(--accent)', borderRadius: 2, transition: 'width 0.5s' }} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* All projects table */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Alle Projekte — Detailtabelle</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Projekt', 'Kategorie', 'Votes', 'Status', 'Ziel', 'Vergeben', 'Monat'].map((h) => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projLoading ? (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Lade…</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Keine Projekte</td></tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id} className="tr-hover">
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{p.icon || '🎯'}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{p.category || '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border)' }}>{p.votes || 0}</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: p.status === 'active' ? 'var(--green-dim)' : 'var(--bg-tertiary)', color: p.status === 'active' ? 'var(--green)' : 'var(--text-muted)' }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{p.goal_eur ? fmtEur(p.goal_eur) : '—'}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', borderBottom: '1px solid var(--border)' }}>{p.awarded_eur ? fmtEur(p.awarded_eur) : '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{p.month || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
