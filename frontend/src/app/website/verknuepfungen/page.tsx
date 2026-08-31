// frontend/src/app/website/verknuepfungen/page.tsx
// HUI Website → Verknüpfungen — externe Dienste die mit be-hui.com verbunden sind
'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { ConnectionCard, type StatusLevel } from '@/components/website/StatusCard';

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

export default function WebsiteVerknuepfungenPage() {
  const [plausibleStatus, setPlausibleStatus] = useState<StatusLevel>('unknown');
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/website/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const check = data.checks?.find((c: CheckResult) => c.name === 'Plausible');
        setPlausibleStatus(check?.status === 'ok' ? 'ok' : 'warning');
      }
    } catch {
      setPlausibleStatus('unknown');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  return (
    <DashboardLayout title="HUI Website — Verknüpfungen">
      <PageHeader
        title="Verknüpfungen"
        subtitle="Externe Dienste für be-hui.com"
        breadcrumbs={[
          { label: 'HUI Website', href: '/website' },
          { label: 'Verknüpfungen' },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Plausible */}
        <ConnectionCard
          name="Plausible Analytics"
          icon="📊"
          status={loading ? 'unknown' : plausibleStatus}
          description="Privacy-freundliche Web-Analytics"
          actionLabel={plausibleStatus === 'ok' ? 'Öffnen ↗' : 'Öffnen ↗'}
          actionHref="https://plausible.io/be-hui.com"
          external
        />

        {/* Vercel */}
        <ConnectionCard
          name="Vercel"
          icon="▲"
          status="ok"
          description="Hosting & Deployment für be-hui.com"
          actionLabel="Öffnen ↗"
          actionHref="https://vercel.com/dashboard"
          external
        />

        {/* Google Search Console */}
        <ConnectionCard
          name="Google Search Console"
          icon="🔍"
          status="warning"
          description="Indexierung & Suchperformance — noch nicht verbunden"
          actionLabel="Verbinden"
          actionHref="#"
        />

        {/* HUI App */}
        <ConnectionCard
          name="HUI App"
          icon="📱"
          status="ok"
          description="Verknüpfung zur HUI Web-App"
          actionLabel="Öffnen ↗"
          actionHref="https://be-hui.vercel.app"
          external
        />
      </div>
    </DashboardLayout>
  );
}
