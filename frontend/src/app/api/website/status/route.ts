// frontend/src/app/api/website/status/route.ts
// Live-Prüfung von be-hui.com — HTTP-Status, SSL, sitemap, robots, meta-tags, etc.
// Alle Prüfungen erfolgen server-seitig (Vercel Serverless Function).

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SITE_URL = 'https://be-hui.com';

interface CheckResult {
  name:     string;
  status:   'ok' | 'warning' | 'error';
  detail:   string;
  value?:   string;
  latency?: number;
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const start = Date.now();
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const latency = Date.now() - start;
    return { res, latency };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const checks: CheckResult[] = [];
  const activities: { time: string; type: string; message: string }[] = [];

  // 1. Website online + HTTP status + SSL
  try {
    const { res, latency } = await fetchWithTimeout(SITE_URL);
    const https = SITE_URL.startsWith('https://');
    checks.push({
      name: 'Website',
      status: res.ok ? 'ok' : 'warning',
      detail: res.ok ? 'Online' : `HTTP ${res.status}`,
      value: `HTTP ${res.status}`,
      latency,
    });
    checks.push({
      name: 'SSL',
      status: https && res.ok ? 'ok' : 'error',
      detail: https ? 'Aktiv (TLS)' : 'Nicht aktiv',
    });
    activities.push({ time: new Date().toISOString(), type: 'check', message: 'Website geprüft' });
  } catch (e) {
    checks.push({ name: 'Website', status: 'error', detail: 'Nicht erreichbar', value: String(e) });
    checks.push({ name: 'SSL', status: 'error', detail: 'Nicht prüfbar' });
  }

  // 2. Sitemap
  try {
    const { res, latency } = await fetchWithTimeout(`${SITE_URL}/sitemap.xml`);
    if (res.ok) {
      const text = await res.text();
      const urls = (text.match(/<loc>/g) || []).length;
      checks.push({ name: 'Sitemap', status: 'ok', detail: `Erreichbar (${urls} URLs)`, value: `${urls} URLs`, latency });
    } else {
      checks.push({ name: 'Sitemap', status: 'error', detail: `HTTP ${res.status}` });
    }
  } catch {
    checks.push({ name: 'Sitemap', status: 'error', detail: 'Nicht erreichbar' });
  }

  // 3. robots.txt
  try {
    const { res } = await fetchWithTimeout(`${SITE_URL}/robots.txt`);
    if (res.ok) {
      const text = await res.text();
      const hasSitemap = text.includes('Sitemap:');
      checks.push({
        name: 'robots.txt',
        status: 'ok',
        detail: hasSitemap ? 'Erreichbar, Sitemap referenziert' : 'Erreichbar',
      });
    } else {
      checks.push({ name: 'robots.txt', status: 'error', detail: `HTTP ${res.status}` });
    }
  } catch {
    checks.push({ name: 'robots.txt', status: 'error', detail: 'Nicht erreichbar' });
  }

  // 4. Meta-Daten + Structured Data + Canonical
  try {
    const { res } = await fetchWithTimeout(SITE_URL);
    if (res.ok) {
      const html = await res.text();

      // Meta description
      const hasMetaDesc = /<meta\s+name="description"\s+content="[^"]+"/i.test(html);
      checks.push({
        name: 'Meta-Daten',
        status: hasMetaDesc ? 'ok' : 'warning',
        detail: hasMetaDesc ? 'Meta description vorhanden' : 'Meta description fehlt',
      });

      // Open Graph
      const hasOG = /<meta\s+property="og:title"/i.test(html);
      checks.push({
        name: 'Open Graph',
        status: hasOG ? 'ok' : 'warning',
        detail: hasOG ? 'OG-Tags vorhanden' : 'OG-Tags fehlen',
      });

      // Twitter Cards
      const hasTwitter = /<meta\s+name="twitter:card"/i.test(html);
      checks.push({
        name: 'Twitter Cards',
        status: hasTwitter ? 'ok' : 'warning',
        detail: hasTwitter ? 'Twitter Card vorhanden' : 'Twitter Card fehlt',
      });

      // Canonical
      const hasCanonical = /<link\s+rel="canonical"/i.test(html);
      checks.push({
        name: 'Canonicals',
        status: hasCanonical ? 'ok' : 'warning',
        detail: hasCanonical ? 'Canonical gesetzt' : 'Canonical fehlt',
      });

      // Structured Data (JSON-LD)
      const jsonLdBlocks = (html.match(/<script\s+type="application\/ld\+json">/gi) || []).length;
      checks.push({
        name: 'Structured Data',
        status: jsonLdBlocks > 0 ? 'ok' : 'warning',
        detail: jsonLdBlocks > 0 ? `${jsonLdBlocks} JSON-LD Block(s) gefunden` : 'Kein JSON-LD gefunden',
      });

      // Plausible
      const hasPlausible = /plausible\.io/i.test(html);
      checks.push({
        name: 'Plausible',
        status: hasPlausible ? 'ok' : 'warning',
        detail: hasPlausible ? 'Plausible Script integriert' : 'Plausible nicht gefunden',
      });

      activities.push({ time: new Date().toISOString(), type: 'seo', message: 'SEO geprüft' });
    }
  } catch {
    checks.push({ name: 'Meta-Daten', status: 'error', detail: 'Nicht prüfbar' });
  }

  // 5. Mobile viewport
  try {
    const { res } = await fetchWithTimeout(SITE_URL);
    if (res.ok) {
      const html = await res.text();
      const hasViewport = /<meta\s+name="viewport"/i.test(html);
      checks.push({
        name: 'Mobile',
        status: hasViewport ? 'ok' : 'error',
        detail: hasViewport ? 'Viewport Meta-Tag vorhanden' : 'Viewport fehlt',
      });
    }
  } catch {
    checks.push({ name: 'Mobile', status: 'error', detail: 'Nicht prüfbar' });
  }

  // 6. JavaScript (basic check — page loads scripts)
  try {
    const { res } = await fetchWithTimeout(SITE_URL);
    if (res.ok) {
      const html = await res.text();
      const scriptCount = (html.match(/<script/gi) || []).length;
      checks.push({
        name: 'JavaScript',
        status: scriptCount > 0 ? 'ok' : 'warning',
        detail: scriptCount > 0 ? `${scriptCount} Script-Tags` : 'Keine Scripts gefunden',
      });
    }
  } catch {
    checks.push({ name: 'JavaScript', status: 'error', detail: 'Nicht prüfbar' });
  }

  // Calculate health score from real checks
  const totalChecks = checks.length;
  const okChecks = checks.filter(c => c.status === 'ok').length;
  const warningChecks = checks.filter(c => c.status === 'warning').length;
  const errorChecks = checks.filter(c => c.status === 'error').length;
  const healthScore = Math.round((okChecks / totalChecks) * 100);

  // Overall status
  const overallStatus = errorChecks > 0 ? 'error' : warningChecks > 0 ? 'warning' : 'ok';

  return NextResponse.json({
    site: 'be-hui.com',
    url: SITE_URL,
    checkedAt: new Date().toISOString(),
    overallStatus,
    healthScore,
    checks,
    summary: {
      ok: okChecks,
      warning: warningChecks,
      error: errorChecks,
      total: totalChecks,
    },
    activities,
  });
}
