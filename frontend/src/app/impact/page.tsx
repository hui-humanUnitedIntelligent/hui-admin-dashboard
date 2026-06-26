// frontend/src/app/impact/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useImpact } from '@/lib/hooks/useImpact';

function fmtEur(n: number) {
  return `€${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number) { return `${n.toFixed(1)} %`; }

function calcImpact(totalRevenue: number) {
  const brutto = totalRevenue * 0.15;
  const netto  = brutto * 0.85;
  const firma  = brutto * 0.15;
  return { brutto, netto, firma };
}

export default function ImpactPage() {
  const { projects, loading: projLoading } = useImpact({ refreshInterval: 30000 });

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [payLoading,   setPayLoading]   = useState(true);

  const fetchRevenue = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions?limit=5000&status=completed', {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = await res.json();
      setTotalRevenue(json.totalRevenue ?? 0);
    } catch { /* silent */ }
    finally { setPayLoading(false); }
  }, []);

  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);

  const loading = payLoading || projLoading;

  const { brutto: totalBrutto, firma: totalFirma, netto: totalNetto } = calcImpact(totalRevenue);
  const activeProjects = projects.filter(p => p.status === 'active');

  const card: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '20px 24px',
  };

  const kpiStyle = (color: string): React.CSSProperties => ({
    ...card,
    display: 'flex', flexDirection: 'column', gap: 4,
    borderLeft: `3px solid ${color}`,
  });

  return (
    <DashboardLayout>
      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Impact Pool
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            15 % jedes Umsatzes gehen in den gemeinsamen Impact-Pool
          </p>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lade Daten…</p>
        ) : (
          <>
            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              <div style={kpiStyle('var(--accent)')}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gesamtumsatz</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtEur(totalRevenue)}</span>
              </div>
              <div style={kpiStyle('#6366f1')}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Brutto-Impact-Pool (15%)</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtEur(totalBrutto)}</span>
              </div>
              <div style={kpiStyle('#10b981')}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Netto-Impact (85%)</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{fmtEur(totalNetto)}</span>
              </div>
              <div style={kpiStyle('#f59e0b')}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Firmenanteil (15%)</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{fmtEur(totalFirma)}</span>
              </div>
            </div>

            {/* Projekte */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Impact Projekte ({projects.length})
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {activeProjects.length} aktiv
                </span>
              </div>

              {projects.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Keine Projekte gefunden.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {projects.map((p: Record<string, unknown>) => (
                    <div key={String(p.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 8, border: '1px solid var(--border)',
                    }}>
                      {p.icon && (
                        <span style={{ fontSize: 22 }}>{String(p.icon)}</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {String(p.name ?? '—')}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {String(p.category ?? '')} · {String(p.votes ?? 0)} Votes
                          {p.awarded_eur ? ` · ${fmtEur(Number(p.awarded_eur))} vergeben` : ''}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '3px 10px', borderRadius: 20,
                        background: p.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                        color: p.status === 'active' ? '#10b981' : 'var(--text-muted)',
                      }}>
                        {String(p.status ?? 'draft')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
