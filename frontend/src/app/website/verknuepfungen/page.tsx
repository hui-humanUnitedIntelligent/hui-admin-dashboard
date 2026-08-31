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

export default function WebsiteVerknuepfungenPage() {
  const [plausibleStatus, setPlausibleStatus] = useState<StatusLevel>('unknown');
  const [gscConnected, setGscConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [s, g] = await Promise.all([
        fetch('/api/website/status', { cache: 'no-store' }).then(r => r.json()),
        fetch('/gsc-data.json', { cache: 'no-store' }).then(r => r.json()),
      ]);
      const check = s.checks?.find((c: CheckResult) => c.name === 'Plausible');
      setPlausibleStatus(check?.status === 'ok' ? 'ok' : 'warning');
      setGscConnected(g?.connected === true && g?.siteVerified === true);
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
          actionLabel="Öffnen ↗"
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
          status={loading ? 'unknown' : gscConnected ? 'ok' : 'warning'}
          description={gscConnected ? 'Verbunden — Indexierung & Suchperformance' : 'Noch nicht verbunden'}
          actionLabel={gscConnected ? "Öffnen ↗" : "Verbinden"}
          actionHref={gscConnected ? "https://search.google.com/search-console?resource_id=sc-domain:be-hui.com" : "https://search.google.com/search-console"}
          external
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
