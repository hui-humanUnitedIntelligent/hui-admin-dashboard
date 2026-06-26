// frontend/src/app/impact/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useImpact } from '@/lib/hooks/useImpact';
import type { HuiImpactProject } from '@/lib/hooks/useSupabase';

function fmtEur(n: number) {
  return `€${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcImpact(rev: number) {
  const brutto = rev * 0.15;
  return { brutto, netto: brutto * 0.85, firma: brutto * 0.15 };
}

export default function ImpactPage() {
  const { projects, loading: projLoading } = useImpact({ refreshInterval: 30000 });
  const [totalRevenue, setTotalRevenue]    = useState(0);
  const [payLoading,   setPayLoading]      = useState(true);

  const fetchRevenue = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions?limit=5000&status=completed', { credentials: 'include' });
      if (res.ok) {
        const j = await res.json();
        setTotalRevenue(j.totalRevenue ?? 0);
      }
    } catch { /* silent */ } finally { setPayLoading(false); }
  }, []);

  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);

  const { brutto, netto, firma } = calcImpact(totalRevenue);
  const activeProjects = projects.filter(p => p.status === 'active');

  const card: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '20px 24px',
  };

  return (
    <DashboardLayout title="Impact Pool">
      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Impact Pool
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            15 % jedes Umsatzes gehen in den gemeinsamen Impact-Pool
          </p>
        </div>

        {(payLoading || projLoading) ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lade Daten…</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Gesamtumsatz',       value: totalRevenue, color: 'var(--accent)' },
                { label: 'Brutto-Pool (15%)',  value: brutto,       color: '#6366f1' },
                { label: 'Netto-Impact (85%)', value: netto,        color: '#10b981' },
                { label: 'Firmenanteil (15%)', value: firma,        color: '#f59e0b' },
              ].map(k => (
                <div key={k.label} style={{ ...card, borderLeft: `3px solid ${k.color}` }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{fmtEur(k.value)}</span>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Impact Projekte ({projects.length})
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeProjects.length} aktiv</span>
              </div>

              {projects.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Keine Projekte gefunden.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {projects.map((p: HuiImpactProject) => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                      background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                    }}>
                      {(p as unknown as {icon?: string}).icon && (
                        <span style={{ fontSize: 22 }}>{(p as unknown as {icon?: string}).icon}</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.category} · {p.votes ?? 0} Votes
                          {p.awarded_eur ? ` · ${fmtEur(p.awarded_eur)} vergeben` : ''}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: p.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                        color: p.status === 'active' ? '#10b981' : 'var(--text-muted)',
                      }}>
                        {p.status ?? 'draft'}
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
