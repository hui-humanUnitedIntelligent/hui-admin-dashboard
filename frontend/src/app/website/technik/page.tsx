// frontend/src/app/website/technik/page.tsx
// HUI Website → Technischer Status — technische Gesundheitsübersicht für be-hui.com
'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { HealthScore, StatusPill, type StatusLevel } from '@/components/website/StatusCard';

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
  value?: string;
  latency?: number;
}

interface WebsiteStatus {
  healthScore: number;
  overallStatus: 'ok' | 'warning' | 'error';
  checks: CheckResult[];
  checkedAt: string;
}

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 18,
};

function TechRow({ icon, name, status, detail }: { icon: string; name: string; status: StatusLevel; detail: string }) {
  const colorMap: Record<StatusLevel, string> = {
    ok: 'var(--green)',
    warning: 'var(--gold)',
    error: 'var(--red)',
    unknown: 'var(--text-muted)',
  };
  const c = colorMap[status];
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{name}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, maxWidth: 200, textAlign: 'right' }}>{detail}</span>
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: c,
        boxShadow: status === 'ok' ? `0 0 6px ${c}` : 'none',
        flexShrink: 0,
      }} />
    </div>
  );
}

export default function WebsiteTechnikPage() {
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

  const checks = data?.checks ?? [];
  const get = (name: string): CheckResult | undefined => checks.find(c => c.name === name);
  const toStatus = (c?: CheckResult): StatusLevel => c?.status as StatusLevel ?? 'unknown';

  // Ordered tech checks
  const techItems = [
    { icon: '🌐', name: 'Website', check: get('Website') },
    { icon: '🔒', name: 'SSL', check: get('SSL') },
    { icon: '📄', name: 'Sitemap', check: get('Sitemap') },
    { icon: '🤖', name: 'Robots', check: get('robots.txt') },
    { icon: '🔗', name: 'Canonicals', check: get('Canonicals') },
    { icon: '📱', name: 'Mobile', check: get('Mobile') },
    { icon: '⚡', name: 'JavaScript', check: get('JavaScript') },
    { icon: '📊', name: 'Plausible', check: get('Plausible') },
    { icon: '🏷️', name: 'Meta-Daten', check: get('Meta-Daten') },
    { icon: '📐', name: 'Structured Data', check: get('Structured Data') },
  ];

  // Items that are not directly checked but noted
  const notCheckedItems = [
    { icon: '🔍', name: '404-System', status: 'unknown' as StatusLevel, detail: 'Nicht automatisch geprüft' },
    { icon: '🔗', name: 'Interne Links', status: 'unknown' as StatusLevel, detail: 'Nicht automatisch geprüft' },
    { icon: '⏱️', name: 'Ladezeit', status: get('Website') ? (get('Website')!.latency! < 1000 ? 'ok' : 'warning') as StatusLevel : 'unknown', detail: get('Website')?.latency != null ? `${get('Website')!.latency}ms` : 'Nicht gemessen' },
  ];

  const overallStatus: StatusLevel = data?.overallStatus ?? 'unknown';

  return (
    <DashboardLayout title="HUI Website — Technischer Status">
      <PageHeader
        title="Technischer Status"
        subtitle="be-hui.com — Technische Gesundheitsübersicht"
        breadcrumbs={[
          { label: 'HUI Website', href: '/website' },
          { label: 'Technischer Status' },
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
          Fehler: {error}
        </div>
      )}

      {/* Health score banner */}
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
          <span style={{ fontSize: 24 }}>🩺</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Website-Gesundheit: {loading ? 'Wird geprüft…' : `${data?.healthScore ?? '—'}%`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {data ? `Geprüft: ${new Date(data.checkedAt).toLocaleString('de-DE')}` : ''}
            </div>
          </div>
        </div>
        {!loading && data && (
          <HealthScore score={data.healthScore} size={70} />
        )}
      </div>

      {/* Tech checks */}
      <div style={card}>
        <h3 style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 6,
          padding: '0 16px',
          paddingTop: 8,
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
        }}>Prüfungen</h3>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Technische Prüfungen laufen…
          </div>
        ) : (
          <>
            {techItems.map((item, i) => (
              <TechRow
                key={i}
                icon={item.icon}
                name={item.name}
                status={toStatus(item.check)}
                detail={item.check?.detail ?? 'Nicht geprüft'}
              />
            ))}
            {notCheckedItems.map((item, i) => (
              <TechRow
                key={`nc-${i}`}
                icon={item.icon}
                name={item.name}
                status={item.status}
                detail={item.detail}
              />
            ))}
          </>
        )}
      </div>

      {/* Note */}
      {!loading && (
        <div style={{
          marginTop: 16,
          padding: '12px 18px',
          fontSize: 12,
          color: 'var(--text-muted)',
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
        }}>
          💡 Der Gesundheitswert wird aus {data?.checks.length ?? 0} realen Prüfungen berechnet. Nicht automatisch prüfbare Werte (404, interne Links) sind als "nicht geprüft" markiert.
        </div>
      )}
    </DashboardLayout>
  );
}
