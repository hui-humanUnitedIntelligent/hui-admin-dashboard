// frontend/src/app/api/website/gsc/route.ts
// Google Search Console API — live data for be-hui.com
// Pulls search analytics, sitemap status, and indexing info via OAuth token

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GSC_API = 'https://www.googleapis.com/webmasters/v3';
const SITE_URL = 'sc-domain:be-hui.com';

export async function GET() {
  try {
    // Get token from Base44 connector — this endpoint runs server-side
    // The token is injected via environment variable by the connector system
    const token = process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json({
        connected: false,
        error: 'Google Search Console nicht verbunden',
      }, { status: 200 });
    }

    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 1. Verify site access
    const sitesRes = await fetch(`${GSC_API}/sites`, { headers });
    if (!sitesRes.ok) {
      return NextResponse.json({
        connected: true,
        error: `GSC API error: ${sitesRes.status}`,
        siteVerified: false,
      }, { status: 200 });
    }
    const sitesData = await sitesRes.json();
    const hasSite = sitesData.siteEntry?.some((s: { siteUrl: string }) => s.siteUrl === SITE_URL) ?? false;

    if (!hasSite) {
      return NextResponse.json({
        connected: true,
        siteVerified: false,
        error: 'be-hui.com nicht in Google Search Console verifiziert',
      }, { status: 200 });
    }

    // 2. Search analytics (last 28 days) — by page
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const analyticsRes = await fetch(`${GSC_API}/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ['page'],
        rowLimit: 15,
      }),
    });

    let topPages: { url: string; clicks: number; impressions: number; ctr: number; position: number }[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;
    let avgPosition = 0;
    let avgCtr = 0;

    if (analyticsRes.ok) {
      const analyticsData = await analyticsRes.json();
      if (analyticsData.rows) {
        for (const row of analyticsData.rows) {
          topPages.push({
            url: row.keys[0],
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          });
        }
        // Calculate totals
        const summaryRes = await fetch(`${GSC_API}/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            startDate: start,
            endDate: end,
            rowLimit: 1,
          }),
        });
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          if (summaryData.rows && summaryData.rows.length > 0) {
            totalClicks = summaryData.rows[0].clicks;
            totalImpressions = summaryData.rows[0].impressions;
            avgCtr = summaryData.rows[0].ctr;
            avgPosition = summaryData.rows[0].position;
          }
        }
      }
    }

    // 3. Sitemaps
    const sitemapsRes = await fetch(`${GSC_API}/sites/${encodeURIComponent(SITE_URL)}/sitemaps`, { headers });
    let sitemaps: { path: string; lastSubmitted: string; status: string; errors: number; submittedPages?: number }[] = [];
    if (sitemapsRes.ok) {
      const sitemapsData = await sitemapsRes.json();
      if (sitemapsData.sitemap) {
        for (const s of sitemapsData.sitemap) {
          sitemaps.push({
            path: s.path,
            lastSubmitted: s.lastSubmitted,
            status: s.status,
            errors: s.errors || 0,
            submittedPages: s.submittedPages,
          });
        }
      }
    }

    // 4. Query-by-query (top queries)
    const queriesRes = await fetch(`${GSC_API}/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ['query'],
        rowLimit: 10,
      }),
    });

    let topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[] = [];
    if (queriesRes.ok) {
      const queriesData = await queriesRes.json();
      if (queriesData.rows) {
        for (const row of queriesData.rows) {
          topQueries.push({
            query: row.keys[0],
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          });
        }
      }
    }

    return NextResponse.json({
      connected: true,
      siteVerified: true,
      siteUrl: SITE_URL,
      period: { start, end },
      summary: {
        clicks: totalClicks,
        impressions: totalImpressions,
        avgCtr: avgCtr,
        avgPosition: avgPosition,
      },
      topPages,
      topQueries,
      sitemaps,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({
      connected: false,
      error: String(e),
    }, { status: 500 });
  }
}
