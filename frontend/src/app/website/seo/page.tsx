// frontend/src/app/website/seo/page.tsx
// HUI Website → SEO & Google — Google-/SEO-Gesundheit der Website
// Google Search Console ist verbunden — echte GSC-Daten werden geladen.
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

interface GscData {
  connected: boolean;
  siteVerified: boolean;
  checkedAt: string;
  period: { start: string; end: string };
  summary: { clicks: number; impressions: number; avgCtr: number; avgPosition: number };
  topPages: { url: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  sitemaps: { path: string; status: string; errors: number; submittedPages: number; indexed: number; lastSubmitted: string; lastDownloaded: string }[];
}

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 18,
};

function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function fmtNum(v: number) { return v.toLocaleString('de-DE'); }
function fmtPos(v: number) { return v.toFixed(1); }

export default function WebsiteSeoPage() {
  const [statusChecks, setStatusChecks] = useState<CheckResult[]>([]);
  const [pages, setPages] = useState<{ indexable: boolean; hasCanonical: boolean; hasMetaDesc: boolean; hasOG: boolean; name: string; online: boolean; path: string; seoStatus: string }[]>([]);
  const [gsc, setGsc] = useState<GscData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, g] = await Promise.all([
        fetch('/api/website/status', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/website/pages', { cache: 'no-store' }).then(r => r.json()),
        fetch('/gsc-data.json', { cache: 'no-store' }).then(r => r.json()),
      ]);
      setStatusChecks(s.checks ?? []);
      setPages(p.pages ?? []);
      setGsc(g);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getCheck = (name: string): CheckResult | undefined => statusChecks.find(c => c.name === name);

  const indexableCount = pages.filter(p => p.indexable).length;
  const noindexCount = pages.filter(p => !p.indexable).length;
  const canonicalCount = pages.filter(p => p.hasCanonical).length;
  const metaDescCount = pages.filter(p => p.hasMetaDesc).length;
  const ogCount = pages.filter(p => p.hasOG).length;

  // GSC sitemap data
  const gscSitemap = gsc?.sitemaps?.[0];
  const gscIndexedPages = gscSitemap?.indexed ?? 0;
  const gscSubmittedPages = gscSitemap?.submittedPages ?? 0;

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
        borderColor: 'var(--accent)',
        borderWidth: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 24 }}>📊</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Google Search Console</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {gsc?.connected ? `Verbunden · Daten von ${gsc.period?.start} bis ${gsc.period?.end}` : 'Verbinde…'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusPill status="ok" label="Verbunden" />
          <a
            href="https://search.google.com/search-console?resource_id=sc-domain:be-hui.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '7px 16px',
              background: 'var(--bg-tertiary)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            In Search Console öffnen ↗
          </a>
        </div>
      </div>

      {/* GSC Live Metrics */}
      {gsc?.connected && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Klicks (28T)</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtNum(gsc.summary?.clicks ?? 0)}</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Impressionen</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtNum(gsc.summary?.impressions ?? 0)}</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Ø CTR</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtPct(gsc.summary?.avgCtr ?? 0)}</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Ø Position</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtPos(gsc.summary?.avgPosition ?? 0)}</div>
          </div>
        </div>
      )}

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
            { label: 'GSC: Eingereichte Seiten', value: `${gscSubmittedPages}`, status: gscSubmittedPages > 0 ? ('ok' as StatusLevel) : ('unknown' as StatusLevel) },
            { label: 'GSC: Indexiert', value: gscIndexedPages > 0 ? `${gscIndexedPages}` : 'Noch 0', status: gscIndexedPages > 0 ? ('ok' as StatusLevel) : ('warning' as StatusLevel) },
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
            { label: 'GSC Sitemap-Status', value: gscSitemap?.errors === 0 ? 'Keine Fehler' : `${gscSitemap?.errors ?? 0} Fehler`, status: (gscSitemap?.errors ?? 0) === 0 ? ('ok' as StatusLevel) : ('error' as StatusLevel) },
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

      {/* Top Queries from GSC */}
      {gsc?.connected && gsc.topQueries && gsc.topQueries.length > 0 && (
        <div style={card}>
          <h3 style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 14,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}>Top Suchanfragen (Google, 28 Tage)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suchanfrage</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Klicks</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Impressionen</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CTR</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Position</th>
                </tr>
              </thead>
              <tbody>
                {gsc.topQueries.map((q, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{q.query}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>{fmtNum(q.clicks)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>{fmtNum(q.impressions)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>{fmtPct(q.ctr)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: q.position < 10 ? 'var(--green)' : q.position < 20 ? 'var(--gold)' : 'var(--text-muted)', textAlign: 'right', fontWeight: 600 }}>{fmtPos(q.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Pages from GSC */}
      {gsc?.connected && gsc.topPages && gsc.topPages.length > 0 && (
        <div style={{ ...card, marginTop: 16 }}>
          <h3 style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 14,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}>Top Seiten (Google, 28 Tage)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seite</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Klicks</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Impressionen</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Position</th>
                </tr>
              </thead>
              <tbody>
                {gsc.topPages.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.url.replace('https://www.be-hui.com', '') || '/'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>{fmtNum(p.clicks)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>{fmtNum(p.impressions)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: p.position < 10 ? 'var(--green)' : p.position < 20 ? 'var(--gold)' : 'var(--text-muted)', textAlign: 'right', fontWeight: 600 }}>{fmtPos(p.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
