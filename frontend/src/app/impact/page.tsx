// frontend/src/app/impact/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useImpactProjects, usePayments } from '@/lib/hooks/useSupabase';

function fmtEur(n: number) {
  return `€${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number) { return `${n.toFixed(1)} %`; }

function calcImpact(totalRevenue: number) {
  const brutto = totalRevenue * 0.15;
  const netto  = brutto * 0.15;
  const firma  = brutto * 0.85;
  return { brutto, firma, netto };
}

export default function ImpactPage() {
  const { projects, loading: projLoading, refetch: refetchProjects } = useImpactProjects(30000);
  const { payments, loading: payLoading } = usePayments({ refreshInterval: 0, limit: 1000 });

  const loading = payLoading || projLoading;

  const completedPayments = payments.filter((p: {status?: string}) => p.status === 'completed');
  const totalRevenue = completedPayments.reduce((s: number, p: {amount_eur?: number}) => s + (p.amount_eur || 0), 0);
  const { brutto: totalBrutto, firma: totalFirma, netto: totalNetto } = calcImpact(totalRevenue);

  const activeProjects = projects.filter(p => p.status === 'active');

  const card: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '20px 24px',
  };

  const kpiStyle = (color: string): React.CSSProperties => ({
    ...card,
    display: 'flex', flexDirection: 'column', gap: 4,
  });

  return (
    <DashboardLayout title="Impact Pool">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Impact Pool</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Impact-Projekte & Pool-Verteilung · 15%-Regel
          </p>
        </div>
        <button
          onClick={() => refetchProjects()}
          style={{ padding: '7px 14px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: 8, fontSize: 12,
            color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {/* KPI Kacheln */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={kpiStyle('#48bb78')}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>GESAMTUMSATZ</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#48bb78' }}>{fmtEur(totalRevenue)}</div>
        </div>
        <div style={kpiStyle('#4299e1')}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>BRUTTO IMPACT (15%)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#4299e1' }}>{fmtEur(totalBrutto)}</div>
        </div>
        <div style={kpiStyle('#ed8936')}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>FIRMENANTEIL (85%)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ed8936' }}>{fmtEur(totalFirma)}</div>
        </div>
        <div style={kpiStyle('#9f7aea')}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>NETTO IMPACT (15%)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#9f7aea' }}>{fmtEur(totalNetto)}</div>
        </div>
        <div style={kpiStyle('var(--text-primary)')}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AKTIVE PROJEKTE</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{activeProjects.length}</div>
        </div>
      </div>

      {/* Projekte Liste */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
          Impact Projekte ({projects.length})
        </h3>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            Laden…
          </div>
        ) : projects.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            Keine Projekte gefunden.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {projects.map(p => (
              <div key={p.id} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{p.icon ?? '🌱'}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.category}</div>
                  </div>
                  <span style={{
                    marginLeft: 'auto', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: p.status === 'active' ? '#48bb7822' : '#a0aec022',
                    color: p.status === 'active' ? '#48bb78' : '#a0aec0',
                  }}>{p.status}</span>
                </div>
                {p.goal_eur && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Ziel: {fmtEur(p.goal_eur)} · Vergeben: {fmtEur(p.awarded_eur ?? 0)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
