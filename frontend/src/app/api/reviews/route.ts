// frontend/src/app/api/reviews/route.ts
// ── HUI Admin — Community Reviews API ─────────────────────────────────────
// GET  /api/reviews?type=pending|published   → JSON Liste
// POST /api/reviews  { action, id }          → Dashboard-Aktionen (JSON)

import { NextRequest, NextResponse } from 'next/server';

const GH_TOKEN  = process.env.GH_TOKEN || '';
const GH_REPO   = 'hui-humanUnitedIntelligent/be-HUI-Website';
const GH_BRANCH = 'main';

// ── GitHub helpers ────────────────────────────────────────────────────────
async function ghGet(path: string): Promise<{ content: unknown; sha: string }> {
  if (!GH_TOKEN) return { content: null, sha: '' };
  const r = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`,
    { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' }
  );
  if (!r.ok) return { content: null, sha: '' };
  const data = await r.json();
  try {
    const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    return { content: JSON.parse(decoded), sha: data.sha };
  } catch { return { content: null, sha: data.sha || '' }; }
}

async function ghPut(path: string, content: unknown, sha: string, message: string) {
  const encoded = Buffer.from(JSON.stringify(content, null, 2), 'utf-8').toString('base64');
  const body: Record<string, string> = { message, content: encoded, branch: GH_BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${path}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' }, body: JSON.stringify(body) }
  );
  if (!r.ok) throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Fallback: Daten direkt von be-hui.com holen (public JSON) ─────────────
async function fetchPublicReviews(): Promise<unknown[]> {
  try {
    const r = await fetch('https://be-hui.com/data/reviews.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// ── Aktionen ──────────────────────────────────────────────────────────────
async function doApprove(id: string): Promise<{ ok: boolean; name?: string }> {
  const { content: pending, sha: pendingSha } = await ghGet('data/pending_reviews.json');
  const arr = Array.isArray(pending) ? pending as Record<string, unknown>[] : [];
  const review = arr.find(r => r.id === id);
  if (!review) return { ok: false };

  await ghPut('data/pending_reviews.json', arr.filter(r => r.id !== id), pendingSha, `review: approve ${id}`);

  const { content: published, sha: pubSha } = await ghGet('data/reviews.json');
  const newPub = [
    ...(Array.isArray(published) ? published as Record<string, unknown>[] : []),
    { id: review.id, name: review.name, stars: review.stars, message: review.message, date: review.date, approvedAt: new Date().toISOString() }
  ];
  await ghPut('data/reviews.json', newPub, pubSha, `review: publish by ${review.name}`);
  return { ok: true, name: String(review.name || '') };
}

async function doReject(id: string): Promise<boolean> {
  const { content: pending, sha: pendingSha } = await ghGet('data/pending_reviews.json');
  const arr = Array.isArray(pending) ? pending as Record<string, unknown>[] : [];
  if (!arr.find(r => r.id === id)) return false;
  await ghPut('data/pending_reviews.json', arr.filter(r => r.id !== id), pendingSha, `review: reject ${id}`);
  return true;
}

async function doDeletePublished(id: string): Promise<boolean> {
  const { content: published, sha: pubSha } = await ghGet('data/reviews.json');
  const arr = Array.isArray(published) ? published as Record<string, unknown>[] : [];
  if (!arr.find(r => r.id === id)) return false;
  await ghPut('data/reviews.json', arr.filter(r => r.id !== id), pubSha, `review: delete ${id}`);
  return true;
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');

  if (type === 'published') {
    // Primär: GitHub API (hat approvedAt etc.)
    // Fallback: öffentliche JSON direkt von be-hui.com
    let data: unknown[] = [];
    if (GH_TOKEN) {
      const { content } = await ghGet('data/reviews.json');
      data = Array.isArray(content) ? content : [];
    }
    if (!data.length) {
      data = await fetchPublicReviews();
    }
    return NextResponse.json(data);
  }

  if (type === 'pending') {
    if (!GH_TOKEN) return NextResponse.json([]);
    const { content } = await ghGet('data/pending_reviews.json');
    return NextResponse.json(Array.isArray(content) ? content : []);
  }

  return NextResponse.json({ error: 'Missing type param' }, { status: 400 });
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!GH_TOKEN) {
    return NextResponse.json({ error: 'GH_TOKEN nicht gesetzt — bitte in Vercel ENV hinterlegen' }, { status: 503 });
  }

  const { action, id } = await req.json();

  if (action === 'approve') {
    const result = await doApprove(id);
    if (!result.ok) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json({ success: true, review: { name: result.name } });
  }

  if (action === 'reject') {
    const ok = await doReject(id);
    if (!ok) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_published') {
    const ok = await doDeletePublished(id);
    if (!ok) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
