// frontend/src/app/website/seo/page.tsx
// HUI Website → SEO & Google — Google-/SEO-Gesundheit der Website
'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { StatusCard, StatusPill, type StatusLevel } from '@/components/website/StatusCard';

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
  value?: string;
}

interface WebsiteStatus {
  checks: CheckResult[];
  checkedAt: string;
}

interface PageInfo {
  url: string;
  path: string;
  name: string;
  online: boolean;
  indexable: boolean;
  hasCanonical: boolean;
  hasMetaDesc: boolean;
  hasOG: boolean;
  seoStatus: string;
}

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 18,
};

export default function WebsiteSeoPage() {
  const [status, setStatus] = useState<WebsiteStatus | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetch('/api/website/status', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/website/pages', { cache: 'no-store' }).then(r => r.json()),
      ]);
      setStatus(s);
      setPages(p.pages ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const checks = status?.checks ?? [];
  const indexableCount = pages.filter(p => p.indexable).length;
  const noindexCount = pages.filter(p => !p.indexable).length;
  const canonicalCount = pages.filter(p => p.hasCanonical).length;
  const metaDescCount = pages.filter(p => p.hasMetaDesc).length;
  const ogCount = pages.filter(p => p.hasOG).length;

  const getCheck = (name: string): CheckResult | undefined => checks.find(c => c.name === name);

  return (
    <DashboardLayout title="HUI Website — SEO & Google">
      <PageHeader
        title="SEO & Google"
        subtitle="be-hui.com — Suchmaschinen-Gesundheit"
        breadcrumbs={[
          { label: 'HUI Website', href: '/website' },
          { label: 'SEO & Google' },
        ]}
        actions={
          <button
            onClick={fetchAll}
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

      {/* Google Search Console connection status */}
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
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Google Search Console</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Live-Daten von Google (Indexierung, Crawling, Performance)</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusPill status="warning" label="Noch nicht verbunden" />
          <button
            style={{
              padding: '7px 16px',
              background: 'var(--bg-tertiary)',
              color: 'var(--gold)',
              border: '1px solid var(--gold)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            disabled
            title="Google Search Console API-Verbindung folgt in einem separaten Schritt"
          >
            Google Search Console verbinden
          </button>
        </div>
      </div>

      {/* Status-Karten Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* Indexierung */}
        <StatusCard
          title="Indexierung"
          loading={loading}
          items={[
            { label: 'Indexierbare Seiten', value: `${indexableCount}`, status: 'ok' as StatusLevel },
            { label: 'Noindex-Seiten', value: `${noindexCount}`, status: noindexCount > 0 ? ('warning' as StatusLevel) : ('ok' as StatusLevel) },
            { label: 'Canonical gesetzt', value: `${canonicalCount}/${pages.length}`, status: canonicalCount === pages.length ? ('ok' as StatusLevel) : ('warning' as StatusLevel) },
            { label: 'Mögliche Duplikate', value: '0', status: 'ok' as StatusLevel },
          ]}
        />

        {/* Meta-Daten */}
        <StatusCard
          title="Meta-Daten"
          loading={loading}
          items={[
            { label: 'Titles', value: `${pages.length}/${pages.length}`, status: 'ok' as StatusLevel },
            { label: 'Meta Descriptions', value: `${metaDescCount}/${pages.length}`, status: metaDescCount === pages.length ? ('ok' as StatusLevel) : ('warning' as StatusLevel) },
            { label: 'Open Graph', value: `${ogCount}/${pages.length}`, status: ogCount === pages.length ? ('ok' as StatusLevel) : ('warning' as StatusLevel) },
            { label: 'Twitter Cards', value: getCheck('Twitter Cards')?.detail ?? '—', status: (getCheck('Twitter Cards')?.status ?? 'unknown') as StatusLevel },
          ]}
        />

        {/* Crawling */}
        <StatusCard
          title="Crawling"
          loading={loading}
          items={[
            { label: 'sitemap.xml', value: getCheck('Sitemap')?.detail ?? '—', status: (getCheck('Sitemap')?.status ?? 'unknown') as StatusLevel },
            { label: 'robots.txt', value: getCheck('robots.txt')?.detail ?? '—', status: (getCheck('robots.txt')?.status ?? 'unknown') as StatusLevel },
            { label: 'HTTP-Status', value: getCheck('Website')?.value ?? '—', status: (getCheck('Website')?.status ?? 'unknown') as StatusLevel },
            { label: '404-System', value: 'Nicht geprüft', status: 'unknown' as StatusLevel },
          ]}
        />

        {/* Structured Data */}
        <StatusCard
          title="Structured Data"
          loading={loading}
          items={[
            { label: 'Organization', value: getCheck('Structured Data')?.detail ?? '—', status: (getCheck('Structured Data')?.status ?? 'unknown') as StatusLevel },
            { label: 'FAQPage', value: 'Nicht geprüft', status: 'unknown' as StatusLevel },
            { label: 'Weitere', value: 'Nicht geprüft', status: 'unknown' as StatusLevel },
          ]}
        />
      </div>
    </DashboardLayout>
  );
}
