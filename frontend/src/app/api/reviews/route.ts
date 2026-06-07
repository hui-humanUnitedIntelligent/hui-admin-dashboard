// frontend/src/app/api/reviews/route.ts
// ── HUI Admin — Community Reviews API ─────────────────────────────────────
// Liest/schreibt pending_reviews.json und reviews.json im be-HUI-Website Repo

import { NextRequest, NextResponse } from 'next/server';

const GH_TOKEN    = process.env.GH_TOKEN || '';
const GH_REPO     = 'hui-humanUnitedIntelligent/be-HUI-Website';
const GH_BRANCH   = 'main';

function toB64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}
function fromB64(str: string): string {
  return Buffer.from(str.replace(/\n/g, ''), 'base64').toString('utf-8');
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

// GET  /api/reviews?type=pending|published
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'pending';
  const path = type === 'published' ? 'data/reviews.json' : 'data/pending_reviews.json';
  const { content } = await ghGet(path);
  return NextResponse.json(Array.isArray(content) ? content : []);
}

// POST /api/reviews  { action: 'approve'|'reject'|'delete_published', id }
export async function POST(req: NextRequest) {
  const { action, id } = await req.json();

  if (action === 'approve') {
    const { content: pending, sha: pendingSha } = await ghGet('data/pending_reviews.json');
    const arr = Array.isArray(pending) ? pending as Record<string,unknown>[] : [];
    const review = arr.find(r => r.id === id);
    if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const newPending = arr.filter(r => r.id !== id);
    await ghPut('data/pending_reviews.json', newPending, pendingSha, `review: approve ${id}`);

    const { content: published, sha: pubSha } = await ghGet('data/reviews.json');
    const newPub = [...(Array.isArray(published) ? published as Record<string,unknown>[] : []),
      { id: review.id, name: review.name, stars: review.stars, message: review.message, date: review.date }
    ];
    await ghPut('data/reviews.json', newPub, pubSha, `review: publish by ${review.name}`);
    return NextResponse.json({ success: true });
  }

  if (action === 'reject') {
    const { content: pending, sha: pendingSha } = await ghGet('data/pending_reviews.json');
    const arr = Array.isArray(pending) ? pending as Record<string,unknown>[] : [];
    await ghPut('data/pending_reviews.json', arr.filter(r => r.id !== id), pendingSha, `review: reject ${id}`);
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_published') {
    const { content: published, sha: pubSha } = await ghGet('data/reviews.json');
    const arr = Array.isArray(published) ? published as Record<string,unknown>[] : [];
    await ghPut('data/reviews.json', arr.filter(r => r.id !== id), pubSha, `review: delete published ${id}`);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
