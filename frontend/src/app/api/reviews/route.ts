// frontend/src/app/api/reviews/route.ts
// ── HUI Admin — Reviews Proxy ─────────────────────────────────────────────
// Alle Schreiboperationen direkt via GitHub API (kein CORS-Problem)
// GET  ?type=published|pending
// POST { action: 'delete'|'approve'|'reject', id }

import { NextRequest, NextResponse } from 'next/server';

const GH_TOKEN  = process.env.GH_TOKEN || '';
const GH_REPO   = 'hui-humanUnitedIntelligent/be-HUI-Website';
const GH_BRANCH = 'main';

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

async function ghGetFile(path: string): Promise<{ data: unknown[]; sha: string }> {
  if (!GH_TOKEN) return { data: [], sha: '' };
  const r = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`,
    { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' }
  );
  if (!r.ok) return { data: [], sha: '' };
  const d = await r.json();
  try {
    const decoded = Buffer.from(d.content.replace(/\n/g,''), 'base64').toString('utf-8');
    return { data: JSON.parse(decoded), sha: d.sha };
  } catch { return { data: [], sha: d.sha || '' }; }
}

async function ghPutFile(path: string, data: unknown[], sha: string, msg: string) {
  const encoded = Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64');
  const body: Record<string,string> = { message: msg, content: encoded, branch: GH_BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(
    `https://api.github.com/repos/${GH_REPO}/contents/${path}`,
    { method:'PUT', headers:{ Authorization:`Bearer ${GH_TOKEN}`, 'Content-Type':'application/json', Accept:'application/vnd.github+json' }, body: JSON.stringify(body) }
  );
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function OPTIONS() {
  return new NextResponse(null, { status:204, headers:{ 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type' } });
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');

  if (type === 'published') {
    // Direkt public JSON — kein Token nötig
    try {
      const r = await fetch(`https://www.be-hui.com/data/reviews.json?t=${Date.now()}`, { cache:'no-store' });
      const data = r.ok ? await r.json() : [];
      return cors(NextResponse.json(Array.isArray(data) ? data : []));
    } catch {
      // Fallback: GitHub direkt
      const { data } = await ghGetFile('data/reviews.json');
      return cors(NextResponse.json(data));
    }
  }

  if (type === 'pending') {
    if (!GH_TOKEN) return cors(NextResponse.json([]));
    const { data } = await ghGetFile('data/pending_reviews.json');
    return cors(NextResponse.json(data));
  }

  return cors(NextResponse.json({ error: 'Missing type' }, { status: 400 }));
}

export async function POST(req: NextRequest) {
  if (!GH_TOKEN) {
    return cors(NextResponse.json({
      error: 'GH_TOKEN fehlt in Vercel ENV. Bitte unter Settings → Environment Variables setzen.'
    }, { status: 503 }));
  }

  const { action, id } = await req.json();
  if (!id) return cors(NextResponse.json({ error: 'Missing id' }, { status: 400 }));

  // ── LÖSCHEN (veröffentlicht) ────────────────────────────────────────────
  if (action === 'delete') {
    const { data, sha } = await ghGetFile('data/reviews.json');
    const arr = data as Record<string,unknown>[];
    const filtered = arr.filter(r => r.id !== id);
    if (filtered.length === arr.length) return cors(NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }));
    await ghPutFile('data/reviews.json', filtered, sha, `review: delete ${id}`);
    return cors(NextResponse.json({ success: true }));
  }

  // ── VERÖFFENTLICHEN (pending → published) ───────────────────────────────
  if (action === 'approve') {
    const { data: pending, sha: pendingSha } = await ghGetFile('data/pending_reviews.json');
    const pArr = pending as Record<string,unknown>[];
    const review = pArr.find(r => r.id === id);
    if (!review) return cors(NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }));

    await ghPutFile('data/pending_reviews.json', pArr.filter(r => r.id !== id), pendingSha, `review: approve ${id}`);

    const { data: published, sha: pubSha } = await ghGetFile('data/reviews.json');
    const newPub = [
      ...(published as Record<string,unknown>[]),
      { id: review.id, name: review.name, stars: review.stars, message: review.message, date: review.date, approvedAt: new Date().toISOString() }
    ];
    await ghPutFile('data/reviews.json', newPub, pubSha, `review: publish by ${review.name}`);
    return cors(NextResponse.json({ success: true, name: review.name }));
  }

  // ── ABLEHNEN (pending löschen) ──────────────────────────────────────────
  if (action === 'reject') {
    const { data, sha } = await ghGetFile('data/pending_reviews.json');
    const arr = data as Record<string,unknown>[];
    const filtered = arr.filter(r => r.id !== id);
    if (filtered.length === arr.length) return cors(NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }));
    await ghPutFile('data/pending_reviews.json', filtered, sha, `review: reject ${id}`);
    return cors(NextResponse.json({ success: true }));
  }

  return cors(NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 }));
}
