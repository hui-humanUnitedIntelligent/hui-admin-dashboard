// frontend/src/app/website/analytics/page.tsx
// HUI Website → Analytics — Website-Analyse für be-hui.com via Plausible
'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { StatusPill, type StatusLevel } from '@/components/website/StatusCard';

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 18,
};

const PLAUSIBLE_URL = 'https://plausible.io/be-hui.com';

export default function WebsiteAnalyticsPage() {
  const [plausibleActive, setPlausibleActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkPlausible = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/website/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const check = data.checks?.find((c: CheckResult) => c.name === 'Plausible');
        setPlausibleActive(check?.status === 'ok');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkPlausible(); }, [checkPlausible]);

  return (
    <DashboardLayout title="HUI Website — Analytics">
      <PageHeader
        title="Analytics"
        subtitle="be-hui.com — Plausible Analytics"
        breadcrumbs={[
          { label: 'HUI Website', href: '/website' },
          { label: 'Analytics' },
        ]}
        actions={
          <a
            href={PLAUSIBLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: '#0F1117',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Plausible öffnen ↗
          </a>
        }
      />

      {/* Connection status */}
      <div style={{
        ...card,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 24 }}>📊</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Plausible Analytics</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {loading ? 'Verbindung wird geprüft…' : plausibleActive ? 'Plausible ist auf be-hui.com aktiv' : 'Verbindung unbekannt'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading ? (
            <StatusPill status="unknown" label="Wird geprüft" />
          ) : plausibleActive ? (
            <StatusPill status="ok" label="Plausible verbunden" />
          ) : (
            <StatusPill status="warning" label="Status unbekannt" />
          )}
        </div>
      </div>

      {/* Stats overview — from Plausible (placeholder until API connected) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        {[
          { label: 'Besucher', value: '—', hint: 'In Plausible verfügbar' },
          { label: 'Besuche', value: '—', hint: 'In Plausible verfügbar' },
          { label: 'Seitenaufrufe', value: '—', hint: 'In Plausible verfügbar' },
          { label: 'Views/Besuch', value: '—', hint: 'In Plausible verfügbar' },
          { label: 'Ø Besuchsdauer', value: '—', hint: 'In Plausible verfügbar' },
        ].map((stat, i) => (
          <div key={i} style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.hint}</div>
          </div>
        ))}
      </div>

      {/* Info: Plausible API not yet connected */}
      <div style={card}>
        <h3 style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 14,
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
        }}>Meistbesuchte Seiten & Quellen</h3>
        <div style={{
          padding: '28px 0',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}>
          <p style={{ marginBottom: 8 }}>Detaillierte Analytics-Daten sind direkt in Plausible verfügbar.</p>
          <p style={{ marginBottom: 16 }}>Eine API-Verbindung zur Anzeige direkt im Admin-Dashboard kann später eingerichtet werden.</p>
          <a
            href={PLAUSIBLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 20px',
              background: 'var(--bg-tertiary)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Plausible Dashboard öffnen ↗
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
