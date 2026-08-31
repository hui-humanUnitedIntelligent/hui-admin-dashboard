// frontend/src/app/api/website/pages/route.ts
// Liefert alle öffentlichen Seiten von be-hui.com basierend auf der sitemap.xml.
// Zusätzlich wird jede Seite live auf HTTP-Status, Canonical und Indexierbarkeit geprüft.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SITE_URL = 'https://be-hui.com';

interface PageInfo {
  url:        string;
  path:       string;
  name:       string;
  httpStatus:  number | null;
  online:     boolean;
  indexable:  boolean;
  hasCanonical: boolean;
  hasMetaDesc:  boolean;
  hasOG:        boolean;
  lastmod:    string | null;
  seoStatus:  'ok' | 'warning' | 'error' | 'unknown';
}

async function fetchWithTimeout(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function pathToName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return 'Startseite';
  const last = parts[parts.length - 1];
  // Readable name from URL slug
  const name = last
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return name;
}

export async function GET() {
  try {
    // 1. Fetch sitemap
    const sitemapRes = await fetchWithTimeout(`${SITE_URL}/sitemap.xml`);
    if (!sitemapRes.ok) {
      return NextResponse.json({ error: 'Sitemap nicht erreichbar', pages: [] }, { status: 502 });
    }

    const sitemapText = await sitemapRes.text();

    // Parse URLs from sitemap
    const urlEntries: { loc: string; lastmod: string | null }[] = [];
    const urlBlocks = sitemapText.split(/<\/url>/);

    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
      const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
      if (locMatch) {
        urlEntries.push({
          loc: locMatch[1].trim(),
          lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
        });
      }
    }

    // 2. Check each page (limit to 15 most important to avoid timeout)
    const pages: PageInfo[] = [];
    const urlsToCheck = urlEntries.slice(0, 15);

    for (const entry of urlsToCheck) {
      const url = entry.loc;
      const path = url.replace(SITE_URL, '') || '/';
      const name = pathToName(path);

      let httpStatus: number | null = null;
      let online = false;
      let indexable = true;
      let hasCanonical = false;
      let hasMetaDesc = false;
      let hasOG = false;
      let seoStatus: PageInfo['seoStatus'] = 'unknown';

      try {
        const res = await fetchWithTimeout(url);
        httpStatus = res.status;
        online = res.ok;

        if (res.ok) {
          const html = await res.text();

          // Check robots meta
          const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
          indexable = !noindex;

          // Canonical
          hasCanonical = /<link\s+rel="canonical"/i.test(html);

          // Meta description
          hasMetaDesc = /<meta\s+name="description"/i.test(html);

          // Open Graph
          hasOG = /<meta\s+property="og:title"/i.test(html);

          // SEO status from real checks
          const issues = [!hasCanonical, !hasMetaDesc, !hasOG, noindex].filter(Boolean).length;
          seoStatus = issues === 0 ? 'ok' : issues <= 2 ? 'warning' : 'error';
        } else {
          seoStatus = 'error';
        }
      } catch {
        online = false;
        seoStatus = 'error';
      }

      pages.push({
        url,
        path,
        name,
        httpStatus,
        online,
        indexable,
        hasCanonical,
        hasMetaDesc,
        hasOG,
        lastmod: entry.lastmod,
        seoStatus,
      });
    }

    return NextResponse.json({
      total: urlEntries.length,
      checked: pages.length,
      pages,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), pages: [] }, { status: 500 });
  }
}
