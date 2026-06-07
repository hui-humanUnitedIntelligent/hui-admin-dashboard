// frontend/src/app/api/reviews/route.ts
// ── HUI Admin — Community Reviews API ─────────────────────────────────────
// GET  /api/reviews?type=pending|published            → JSON Liste
// GET  /api/reviews?action=approve|reject&id=...&token=... → E-Mail-Button Handler (HTML)
// POST /api/reviews  { action, id }                  → Dashboard-Aktionen (JSON)

import { NextRequest, NextResponse } from 'next/server';

const GH_TOKEN      = process.env.GH_TOKEN || '';
const GH_REPO       = 'hui-humanUnitedIntelligent/be-HUI-Website';
const GH_BRANCH     = 'main';
const REVIEW_SECRET = process.env.HUI_REVIEW_SECRET || 'hui-review-secret-2026';
const SITE_URL      = 'https://be-hui.com';
const DASHBOARD_URL = 'https://hui-admin-dashboard.vercel.app';

function toB64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}
function fromB64(str: string): string {
  return Buffer.from(str.replace(/\n/g, ''), 'base64').toString('utf-8');
}

function htmlPage(body: string): NextResponse {
  const page = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HUI – Bewertungen</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f7f5f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
    .card{background:#fff;border-radius:20px;padding:3rem 2.5rem;max-width:460px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.1)}
    h2{font-size:1.5rem;margin-bottom:.75rem;color:#1a1a1a}
    p{color:#666;line-height:1.6;margin-bottom:1.5rem}
    .btn{display:inline-block;padding:.85rem 2rem;background:#1ed8c8;color:#fff;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px}
    .btn-dark{background:#1a1a1a}
  </style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
  return new NextResponse(page, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function ghGet(path: string): Promise<{ content: unknown; sha: string }> {
  const r = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`,
    { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' }
  );
  if (!r.ok) return { content: [], sha: '' };
  const data = await r.json();
  try { return { content: JSON.parse(fromB64(data.content)), sha: data.sha }; }
  catch { return { content: [], sha: data.sha || '' }; }
}

async function ghPut(path: string, content: unknown, sha: string, message: string) {
  const body: Record<string, string> = {
    message, content: toB64(JSON.stringify(content, null, 2)), branch: GH_BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${path}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' }, body: JSON.stringify(body) }
  );
  if (!r.ok) throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`);
  return r.json();
}

async function doApprove(id: string): Promise<boolean> {
  const { content: pending, sha: pendingSha } = await ghGet('data/pending_reviews.json');
  const arr = Array.isArray(pending) ? pending as Record<string, unknown>[] : [];
  const review = arr.find(r => r.id === id);
  if (!review) return false;

  await ghPut('data/pending_reviews.json', arr.filter(r => r.id !== id), pendingSha, `review: approve ${id}`);

  const { content: published, sha: pubSha } = await ghGet('data/reviews.json');
  const newPub = [
    ...(Array.isArray(published) ? published as Record<string, unknown>[] : []),
    { id: review.id, name: review.name, stars: review.stars, message: review.message, date: review.date }
  ];
  await ghPut('data/reviews.json', newPub, pubSha, `review: publish by ${review.name}`);
  return true;
}

async function doReject(id: string): Promise<boolean> {
  const { content: pending, sha: pendingSha } = await ghGet('data/pending_reviews.json');
  const arr = Array.isArray(pending) ? pending as Record<string, unknown>[] : [];
  if (!arr.find(r => r.id === id)) return false;
  await ghPut('data/pending_reviews.json', arr.filter(r => r.id !== id), pendingSha, `review: reject ${id}`);
  return true;
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const action = sp.get('action');
  const id     = sp.get('id');
  const token  = sp.get('token');
  const type   = sp.get('type');

  // E-Mail-Button: ?action=approve|reject&id=...&token=...
  if (action && id) {
    if (token !== REVIEW_SECRET) {
      return htmlPage('<h2>❌ Ungültiger Token</h2><p>Dieser Link ist nicht gültig oder abgelaufen.</p>');
    }
    if (!GH_TOKEN) {
      return htmlPage('<h2>⚠️ Konfigurationsfehler</h2><p>GH_TOKEN nicht gesetzt. Bitte Vercel ENV prüfen.</p>');
    }

    if (action === 'approve') {
      const ok = await doApprove(id);
      if (!ok) return htmlPage('<h2>⚠️ Nicht gefunden</h2><p>Die Bewertung wurde bereits bearbeitet.</p><a class="btn" style="margin-top:1rem" href="' + DASHBOARD_URL + '/reviews">Zum Dashboard →</a>');
      return htmlPage(`
        <h2 style="color:#1ed8c8">✅ Bewertung veröffentlicht!</h2>
        <p>Die Bewertung ist jetzt live auf der Community-Seite.</p>
        <a class="btn" href="${SITE_URL}/community.html#cm-reviews" style="margin-right:.5rem">Community-Seite →</a>
        <a class="btn btn-dark" href="${DASHBOARD_URL}/reviews" style="margin-top:.75rem;display:block">Zum Dashboard →</a>
      `);
    }

    if (action === 'reject') {
      const ok = await doReject(id);
      if (!ok) return htmlPage('<h2>⚠️ Nicht gefunden</h2><p>Die Bewertung wurde bereits bearbeitet.</p>');
      return htmlPage('<h2>🗑️ Abgelehnt</h2><p>Die Bewertung wurde gelöscht.</p><a class="btn btn-dark" href="' + DASHBOARD_URL + '/reviews" style="margin-top:1rem;display:inline-block">Zum Dashboard →</a>');
    }
  }

  // Dashboard: ?type=pending|published
  const path = type === 'published' ? 'data/reviews.json' : 'data/pending_reviews.json';
  const { content } = await ghGet(path);
  return NextResponse.json(Array.isArray(content) ? content : []);
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { action, id } = await req.json();

  if (action === 'approve') {
    const ok = await doApprove(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (action === 'reject') {
    const ok = await doReject(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_published') {
    const { content: published, sha: pubSha } = await ghGet('data/reviews.json');
    const arr = Array.isArray(published) ? published as Record<string, unknown>[] : [];
    if (!arr.find(r => r.id === id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await ghPut('data/reviews.json', arr.filter(r => r.id !== id), pubSha, `review: delete published ${id}`);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
