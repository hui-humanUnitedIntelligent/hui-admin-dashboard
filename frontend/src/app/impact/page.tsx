// frontend/src/app/impact/page.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/ui/KPICard';
import { useImpactProjects, usePayments } from '@/lib/hooks/useSupabase';

function fmtEur(n: number) {
  return `€${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtEurK(n: number) {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}K`;
  return `€${n.toFixed(0)}`;
}
function fmtPct(n: number) {
  return `${n.toFixed(1)} %`;
}

// ── Impact-Pool Berechnungen (15 % Regel) ─────────────────────────────────────
// Brutto Impact Pool = 15 % von Umsatz
// Firmenanteil       = 15 % von Brutto Impact Pool
// Netto Impact Pool  = 85 % von Brutto Impact Pool
function calcImpact(totalRevenue: number) {
  const brutto = totalRevenue * 0.15;
  const firma  = brutto * 0.15;
  const netto  = brutto * 0.85;
  return { brutto, firma, netto };
}

// ── Monthly buckets from works created_at ─────────────────────────────────────
interface MonthBucket {
  label: string;   // "Mai 2026"
  key: string;     // "2026-05"
  revenue: number;
  brutto: number;
  firma: number;
  netto: number;
}

function buildMonthlyBuckets(
  payments: { amount_eur?: number; created_at?: string }[],
  works:    { price_eur?: number; created_at?: string }[]
): MonthBucket[] {
  // Merge: prefer payments if available, fallback to works
  const allTx: { amount: number; date: string }[] = [];
  payments.forEach(p => { if ((p.amount_eur ?? 0) > 0) allTx.push({ amount: p.amount_eur!, date: p.created_at! }); });
  works.forEach(w => { if ((w.price_eur ?? 0) > 0) allTx.push({ amount: w.price_eur!, date: w.created_at! }); });

  if (!allTx.length) {
    // Demo buckets for empty state
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const revenue = 0;
      return { label: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }), key, revenue, ...calcImpact(revenue) };
    });
  }

  const map = new Map<string, number>();
  allTx.forEach(tx => {
    const key = tx.date.slice(0, 7);
    map.set(key, (map.get(key) || 0) + tx.amount);
  });

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([key, revenue]) => {
      const [y, m] = key.split('-');
      const d = new Date(Number(y), Number(m) - 1, 1);
      const label = d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
      return { label, key, revenue, ...calcImpact(revenue) };
    });
}

// ── Works fetcher ─────────────────────────────────────────────────────────────
function useWorks() {
  const [works, setWorks] = useState<{ price_eur: number; created_at: string }[]>([]);
  const fetch = useCallback(async () => {
    try {
      const r = await globalThis.fetch(
        `/api/admin?table=works&select=price_eur,created_at&limit=1000`
      );
      if (r.ok) {
        const data = await r.json();
        setWorks(Array.isArray(data) ? data : data.data || []);
      }
    } catch {}
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  return { works, refetch: fetch };
}

export default function ImpactPage() {
  const { projects, loading: projLoading, refetch: refetchProjects } = useImpactProjects(30000);
  const { payments, loading: payLoading } = usePayments({ refreshInterval: 30000, limit: 1000 });
  const { works } = useWorks();

  const chartRef      = useRef<HTMLCanvasElement>(null);
  const barChartRef   = useRef<HTMLCanvasElement>(null);
  const pieChartRef   = useRef<HTMLCanvasElement>(null);
  const chartInst     = useRef<unknown>(null);
  const barChartInst  = useRef<unknown>(null);
  const pieChartInst  = useRef<unknown>(null);

  // ── Revenue base: prefer payments, fallback to works ──────────────────────
  const totalRevenue = payments.length
    ? payments.reduce((s, p) => s + (p.amount_eur || 0), 0)
    : works.reduce((s, w) => s + (w.price_eur || 0), 0);

  const { brutto: totalBrutto, firma: totalFirma, netto: totalNetto } = calcImpact(totalRevenue);

  // Month filter
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthPayments = payments.filter(p => p.created_at >= startOfMonth);
  const monthRevenue  = monthPayments.length
    ? monthPayments.reduce((s, p) => s + (p.amount_eur || 0), 0)
    : works.filter(w => (w.created_at || '') >= startOfMonth).reduce((s, w) => s + (w.price_eur || 0), 0);
  const { brutto: monthBrutto, firma: monthFirma, netto: monthNetto } = calcImpact(monthRevenue);

  const totalProjects = projects.length;
  const activeProj    = projects.filter(p => p.status === 'active').length;
  const distributed   = projects.reduce((s, p) => s + (p.awarded_eur || 0), 0);

  // ── Monthly buckets ────────────────────────────────────────────────────────
  const monthly = buildMonthlyBuckets(
    payments.map(p => ({ amount_eur: p.amount_eur, created_at: p.created_at })),
    works
  );

  // ── Doughnut: Vote-Verteilung ──────────────────────────────────────────────
  useEffect(() => {
    if (!projects.length) return;
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (chartRef.current) {
        if (chartInst.current) (chartInst.current as { destroy: () => void }).destroy();
        chartInst.current = new Chart(chartRef.current, {
          type: 'doughnut',
          data: {
            labels: projects.slice(0, 6).map(p => p.name),
            datasets: [{ data: projects.slice(0, 6).map(p => p.votes || 1), backgroundColor: projects.slice(0, 6).map(p => p.color || '#4ECDC4'), borderWidth: 0, hoverOffset: 6 }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#8892A4', font: { size: 11 }, padding: 12 } } } },
        });
      }
    })();
  }, [projects.map(p => p.id).join(',')]);

  // ── Bar: Monatlicher Verlauf ───────────────────────────────────────────────
  useEffect(() => {
    if (!monthly.length) return;
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (barChartRef.current) {
        if (barChartInst.current) (barChartInst.current as { destroy: () => void }).destroy();
        barChartInst.current = new Chart(barChartRef.current, {
          type: 'bar',
          data: {
            labels: monthly.map(m => m.label),
            datasets: [
              { label: 'Netto Impact Pool', data: monthly.map(m => m.netto), backgroundColor: 'rgba(78,205,196,0.75)', borderRadius: 5, stack: 'pool' },
              { label: 'Firmenanteil',      data: monthly.map(m => m.firma), backgroundColor: 'rgba(247,183,49,0.75)',  borderRadius: 5, stack: 'pool' },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#8892A4', font: { size: 11 }, boxWidth: 12 } } },
            scales: {
              x: { stacked: true, ticks: { color: '#8892A4', font: { size: 10 } }, grid: { color: 'rgba(136,146,164,0.08)' } },
              y: { stacked: true, ticks: { color: '#8892A4', font: { size: 10 }, callback: (v: unknown) => `€${Number(v).toFixed(0)}` }, grid: { color: 'rgba(136,146,164,0.08)' } },
            },
          },
        });
      }
    })();
  }, [monthly.map(m => m.key).join(',')]);

  // ── Pie: Pool vs. Firma ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (pieChartRef.current) {
        if (pieChartInst.current) (pieChartInst.current as { destroy: () => void }).destroy();
        pieChartInst.current = new Chart(pieChartRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Netto Impact Pool (85 %)', 'Firmenanteil (15 %)'],
            datasets: [{
              data: [totalNetto || 85, totalFirma || 15],
              backgroundColor: ['rgba(78,205,196,0.85)', 'rgba(247,183,49,0.85)'],
              borderWidth: 2,
              borderColor: 'var(--bg-secondary)',
              hoverOffset: 6,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: '#8892A4', font: { size: 11 }, padding: 14, boxWidth: 12 } },
              tooltip: { callbacks: { label: ctx => ` ${fmtEur(ctx.raw as number)} (${fmtPct((ctx.raw as number) / (totalBrutto || 1) * 100)})` } },
            },
            cutout: '65%',
          },
        });
      }
    })();
  }, [totalBrutto]);

  const refetch = () => { refetchProjects(); };
  const loading = payLoading || projLoading;

  // ── styles ────────────────────────────────────────────────────────────────
  const card = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 };
  const label11 = { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.8px', fontWeight: 600 };
  const mono = { fontFamily: 'var(--font-mono)', fontWeight: 700 };

  return (
    <DashboardLayout
      title="Impact Pool"
      headerActions={
        <button onClick={refetch} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          ↻ Refresh
        </button>
      }
    >
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,rgba(78,205,196,.18),rgba(78,205,196,.05))', border: '1px solid rgba(78,205,196,.25)', borderRadius: 16, padding: '24px', textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>🌱 Impact Pool — Live Stand</div>
        <div style={{ fontSize: 42, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-2px' }}>
          {loading ? '—' : fmtEurK(totalNetto)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Netto Impact Pool · 85 % der 15 % aller Transaktionen</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Brutto: {loading ? '—' : fmtEurK(totalBrutto)} · Firmenanteil: {loading ? '—' : fmtEurK(totalFirma)} · Basis: {loading ? '—' : fmtEurK(totalRevenue)} Umsatz
        </div>
      </div>

      {/* ── 15 % Regel Info ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }} className="grid-3">
        {[
          { label: 'Umsatz (Basis)', value: totalRevenue, pct: '100 %', color: '#74C0FC', desc: 'Gesamtumsatz aller Transaktionen' },
          { label: 'Brutto Impact Pool', value: totalBrutto, pct: '15 % vom Umsatz', color: '#4ECDC4', desc: '15 % jeder Transaktion' },
          { label: 'Netto Impact Pool', value: totalNetto, pct: '85 % der 15 %', color: '#51CF66', desc: 'Geht an Impact-Projekte' },
        ].map(({ label, value, pct, color, desc }) => (
          <div key={label} style={{ ...card, borderLeft: `3px solid ${color}` }}>
            <div style={label11}>{label}</div>
            <div style={{ ...mono, fontSize: 26, color, marginTop: 6 }}>{loading ? '—' : fmtEurK(value)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{pct}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* ── Firmenanteil Banner ─────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,rgba(247,183,49,.12),rgba(247,183,49,.04))', border: '1px solid rgba(247,183,49,.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 24 }}>🏢</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#F7B731', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>Firmenanteil (HUI intern)</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>15 % des Brutto-Impact-Pools → Systemkosten, Infrastruktur, Betrieb</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...mono, fontSize: 28, color: '#F7B731' }}>{loading ? '—' : fmtEurK(totalFirma)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gesamt · Monat: {loading ? '—' : fmtEurK(monthFirma)}</div>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }} className="grid-4">
        <KPICard label="Impact Pool (Monat)"  value={loading ? '—' : fmtEurK(monthNetto)}   delta="Netto"    deltaPositive icon="↓" accentColor="#4ECDC4" accentDim="rgba(78,205,196,0.12)" />
        <KPICard label="Firma-Einnahmen/Monat" value={loading ? '—' : fmtEurK(monthFirma)} delta="15 % der 15 %" deltaPositive icon="🏢" accentColor="#F7B731" accentDim="rgba(247,183,49,0.12)" />
        <KPICard label="Projekte aktiv"        value={projLoading ? '—' : String(activeProj)}  delta="aktiv"    deltaPositive icon="✅" accentColor="#51CF66" accentDim="rgba(81,207,102,0.12)" />
        <KPICard label="Bereits ausgeschüttet" value={projLoading ? '—' : fmtEurK(distributed)} delta="an Projekte" deltaPositive icon="🎯" accentColor="#74C0FC" accentDim="rgba(116,192,252,0.12)" />
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginBottom: 18 }} className="grid-2-1">

        {/* Stacked Bar: monatlicher Verlauf */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>📊 Monatlicher Verlauf</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Netto Impact Pool vs. Firmenanteil — gestapelt</div>
          <div style={{ position: 'relative', height: 200 }}>
            <canvas ref={barChartRef} />
          </div>
        </div>

        {/* Pie: Pool vs. Firma */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>🥧 Verhältnis</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Netto Impact Pool vs. Firmenanteil</div>
          <div style={{ position: 'relative', height: 200 }}>
            <canvas ref={pieChartRef} />
          </div>
        </div>
      </div>

      {/* ── Monatstabelle ───────────────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 18, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>📅 Monatsübersicht — Impact-Pool Berechnung</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Letzte 6 Monate</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Monat', 'Umsatz', 'Brutto Pool (15 %)', 'Firmenanteil (15 % der 15 %)', 'Netto Pool (85 % der 15 %)'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthly.map((m, i) => {
                const isCurrentMonth = m.key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                return (
                  <tr key={m.key} style={{ background: isCurrentMonth ? 'rgba(78,205,196,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(136,146,164,0.03)' }}>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontWeight: isCurrentMonth ? 700 : 400, color: isCurrentMonth ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {m.label} {isCurrentMonth && <span style={{ fontSize: 9, background: 'var(--accent)', color: '#fff', padding: '1px 5px', borderRadius: 3, marginLeft: 4 }}>aktuell</span>}
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{fmtEur(m.revenue)}</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: '#4ECDC4' }}>{fmtEur(m.brutto)}</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: '#F7B731' }}>{fmtEur(m.firma)}</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: '#51CF66', fontWeight: 600 }}>{fmtEur(m.netto)}</td>
                  </tr>
                );
              })}
              {/* Summe */}
              <tr style={{ background: 'rgba(78,205,196,0.06)', borderTop: '2px solid rgba(78,205,196,0.25)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)', fontSize: 11 }}>∑ GESAMT</td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)' }}>{fmtEur(monthly.reduce((s, m) => s + m.revenue, 0))}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4ECDC4' }}>{fmtEur(monthly.reduce((s, m) => s + m.brutto, 0))}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F7B731' }}>{fmtEur(monthly.reduce((s, m) => s + m.firma, 0))}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#51CF66' }}>{fmtEur(monthly.reduce((s, m) => s + m.netto, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Votes-Chart + Projekte Liste ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, marginBottom: 18 }} className="grid-2-1">
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Votes-Verteilung</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>Top-Projekte nach Stimmen</div>
          <div style={{ position: 'relative', height: 200 }}>
            {projLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}>Lade…</div>
            ) : projects.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}>Keine Projekte</div>
            ) : <canvas ref={chartRef} />}
          </div>
        </div>

        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Impact-Projekte</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalProjects} total</span>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {projLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Lade…</div>
            ) : projects.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Keine Projekte vorhanden</div>
            ) : projects.map(proj => {
              const goal = proj.goal_eur || 0;
              const awarded = proj.awarded_eur || 0;
              const pct = goal > 0 ? Math.min(100, Math.round((awarded / goal) * 100)) : 0;
              return (
                <div key={proj.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: goal > 0 ? 8 : 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: proj.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{proj.icon || '🎯'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{proj.category || '—'} · {proj.votes || 0} Votes · {proj.status}</div>
                    </div>
                    {goal > 0 && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', flexShrink: 0 }}>{fmtEurK(awarded)} / {fmtEurK(goal)}</div>}
                  </div>
                  {goal > 0 && (
                    <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: proj.color || 'var(--accent)', borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Alle Projekte Tabelle ────────────────────────────────────────────── */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Alle Projekte — Detailtabelle</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Projekt', 'Kategorie', 'Votes', 'Status', 'Ziel', 'Vergeben', 'Monat'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projLoading ? (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Lade…</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Keine Projekte</td></tr>
              ) : projects.map(p => (
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
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: p.status === 'active' ? 'var(--green-dim)' : 'var(--bg-tertiary)', color: p.status === 'active' ? 'var(--green)' : 'var(--text-muted)' }}>{p.status}</span>
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{p.goal_eur ? fmtEurK(p.goal_eur) : '—'}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', borderBottom: '1px solid var(--border)' }}>{p.awarded_eur ? fmtEurK(p.awarded_eur) : '—'}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{p.month || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </DashboardLayout>
  );
}
