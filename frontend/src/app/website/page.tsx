// frontend/src/app/website/page.tsx
// HUI Website → Übersicht — zentrales Website-Cockpit für be-hui.com
'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { StatusCard, StatusPill, HealthScore, type StatusLevel } from '@/components/website/StatusCard';

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
  value?: string;
  latency?: number;
}

interface WebsiteStatus {
  site: string;
  url: string;
  checkedAt: string;
  overallStatus: 'ok' | 'warning' | 'error';
  healthScore: number;
  checks: CheckResult[];
  summary: { ok: number; warning: number; error: number; total: number };
  activities: { time: string; type: string; message: string }[];
}

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 18,
};

export default function WebsiteOverviewPage() {
  const [data, setData] = useState<WebsiteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/website/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Group checks by category
  const checks = data?.checks ?? [];
  const websiteChecks = checks.filter(c => ['Website', 'SSL', 'Mobile', 'JavaScript'].includes(c.name));
  const seoChecks = checks.filter(c => ['Sitemap', 'robots.txt', 'Meta-Daten', 'Open Graph', 'Twitter Cards', 'Canonicals', 'Structured Data'].includes(c.name));
  const techChecks = checks.filter(c => ['Plausible'].includes(c.name));
  const analyticsChecks: CheckResult[] = []; // Analytics data comes from Plausible, not live-checked here

  const mapToItems = (cs: CheckResult[]) => cs.map(c => ({
    label: c.name,
    value: c.detail,
    status: c.status as StatusLevel,
  }));

  const overallStatus: StatusLevel = data?.overallStatus ?? 'unknown';

  return (
    <DashboardLayout title="HUI Website — Übersicht">
      <PageHeader
        title="HUI Website"
        subtitle="be-hui.com"
        breadcrumbs={[
          { label: 'HUI Website', href: '/website' },
          { label: 'Übersicht' },
        ]}
        actions={
          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: '#0F1117',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Prüfe…' : 'Neu prüfen'}
          </button>
        }
      />

      {/* Status banner */}
      <div style={{
        ...card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
        padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 24 }}>🌐</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>be-hui.com</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {data ? `Geprüft: ${new Date(data.checkedAt).toLocaleString('de-DE')}` : 'Wird geprüft…'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {!loading && data && (
            <>
              <HealthScore score={data.healthScore} />
              <StatusPill status={overallStatus} label={
                overallStatus === 'ok' ? 'Alles in Ordnung' :
                overallStatus === 'warning' ? 'Aufmerksamkeit erforderlich' :
                'Problem erkannt'
              } />
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(255,107,107,0.08)',
          border: '1px solid var(--red)',
          borderRadius: 10,
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--red)',
        }}>
          Fehler beim Prüfen: {error}
        </div>
      )}

      {/* Status-Karten Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
        marginBottom: 28,
      }}>
        <StatusCard title="Website" items={loading ? [] : mapToItems(websiteChecks)} loading={loading} />
        <StatusCard title="SEO" items={loading ? [] : mapToItems(seoChecks)} loading={loading} />
        <StatusCard title="Analytics" items={loading ? [] : [
          { label: 'Plausible', value: data?.checks.find(c => c.name === 'Plausible')?.detail ?? 'Nicht verfügbar', status: (data?.checks.find(c => c.name === 'Plausible')?.status ?? 'unknown') as StatusLevel },
        ]} loading={loading} />
        <StatusCard title="Technik" items={loading ? [] : mapToItems([...techChecks, ...websiteChecks.filter(c => c.name === 'Mobile' || c.name === 'JavaScript')])} loading={loading} />
      </div>

      {/* Letzte Aktivitäten */}
      <div style={card}>
        <h3 style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 14,
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
        }}>Letzte Aktivitäten</h3>
        {data?.activities && data.activities.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.activities.map((act, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: i < data.activities.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 12 }}>
                  {act.type === 'check' ? '🔎' : act.type === 'seo' ? '🔍' : act.type === 'deploy' ? '🚀' : '📝'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{act.message}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(act.time).toLocaleTimeString('de-DE')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Noch keine Aktivitäten
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
