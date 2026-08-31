// frontend/src/app/website/seiten/page.tsx
// HUI Website → Seiten — Übersicht aller öffentlichen Seiten von be-hui.com
'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { StatusPill, type StatusLevel } from '@/components/website/StatusCard';

interface PageInfo {
  url: string;
  path: string;
  name: string;
  httpStatus: number | null;
  online: boolean;
  indexable: boolean;
  hasCanonical: boolean;
  hasMetaDesc: boolean;
  hasOG: boolean;
  lastmod: string | null;
  seoStatus: 'ok' | 'warning' | 'error' | 'unknown';
}

interface PagesResponse {
  total: number;
  checked: number;
  pages: PageInfo[];
  checkedAt: string;
}

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 18,
};

export default function WebsiteSeitenPage() {
  const [data, setData] = useState<PagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/website/pages', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  return (
    <DashboardLayout title="HUI Website — Seiten">
      <PageHeader
        title="Seiten"
        subtitle={`be-hui.com · ${data ? `${data.total} Seiten in Sitemap` : 'Lädt…'}`}
        breadcrumbs={[
          { label: 'HUI Website', href: '/website' },
          { label: 'Seiten' },
        ]}
        actions={
          <button
            onClick={fetchPages}
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

      {/* Summary */}
      {!loading && data && (
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}>
          <div style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>In Sitemap</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{data.total}</span>
          </div>
          <div style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Geprüft</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{data.checked}</span>
          </div>
          <div style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Online</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{data.pages.filter(p => p.online).length}</span>
          </div>
          <div style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Indexierbar</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{data.pages.filter(p => p.indexable).length}</span>
          </div>
        </div>
      )}

      {/* Page table */}
      <div style={card}>
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Seiten werden geprüft…
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seite</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>URL</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Indexierbar</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SEO</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Letzte Änderung</th>
                </tr>
              </thead>
              <tbody>
                {data?.pages.map((page, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{page.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      <a href={page.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                        {page.path}
                      </a>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusPill status={page.online ? 'ok' : 'error'} label={page.online ? `Online (${page.httpStatus})` : 'Offline'} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusPill status={page.indexable ? 'ok' : 'warning'} label={page.indexable ? 'Indexierbar' : 'Noindex'} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusPill status={page.seoStatus as StatusLevel} label={page.seoStatus === 'ok' ? 'SEO' : page.seoStatus === 'warning' ? 'Achtung' : page.seoStatus === 'error' ? 'Problem' : 'Unbekannt'} />
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {page.lastmod ? new Date(page.lastmod).toLocaleDateString('de-DE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
