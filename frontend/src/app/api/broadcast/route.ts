// frontend/src/app/api/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function sbFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    headers: H,
    ...opts,
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

// GET — stats + list past broadcasts
export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'stats') {
    const [profilesRes, broadcastsRes] = await Promise.all([
      fetch(`${SUPA}/rest/v1/profiles?select=id,role,is_wirker,is_member&limit=2000`, { headers: H }),
      fetch(`${SUPA}/rest/v1/notifications?type=eq.admin_broadcast&select=metadata&limit=2000`, { headers: H }),
    ]);
    const profiles   = await profilesRes.json().catch(() => []);
    const broadcasts = await broadcastsRes.json().catch(() => []);
    const p = Array.isArray(profiles) ? profiles : [];

    // Count unique broadcast IDs
    const broadcastIds = new Set<string>();
    for (const n of (Array.isArray(broadcasts) ? broadcasts : [])) {
      const bid = (n.metadata as Record<string,unknown>)?.broadcast_id as string;
      if (bid) broadcastIds.add(bid);
    }

    return NextResponse.json({
      total_users:       p.length,
      wirker:            p.filter((x: Record<string,unknown>) => x.is_wirker).length,
      members:           p.filter((x: Record<string,unknown>) => x.is_member).length,
      admins:            p.filter((x: Record<string,unknown>) => ['admin','superadmin'].includes(x.role as string)).length,
      total_broadcasts:  broadcastIds.size,
    });
  }

  if (action === 'list') {
    const res = await fetch(
      `${SUPA}/rest/v1/notifications?type=eq.admin_broadcast&order=created_at.desc&limit=500&select=id,title,body,created_at,metadata`,
      { headers: H }
    );
    const data = await res.json().catch(() => []);

    // De-duplicate by broadcast_id — one entry per broadcast
    const seen = new Set<string>();
    const broadcasts: unknown[] = [];
    for (const n of (Array.isArray(data) ? data : [])) {
      const bid = (n.metadata as Record<string,unknown>)?.broadcast_id as string;
      if (bid && !seen.has(bid)) {
        seen.add(bid);
        const meta = n.metadata as Record<string,unknown>;
        broadcasts.push({
          id:           bid,
          title:        n.title,
          body:         n.body,
          created_at:   n.created_at,
          target_group: meta?.target_group || 'all',
          sent_count:   meta?.sent_count   || 0,
        });
      }
    }
    return NextResponse.json(broadcasts);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// POST — send broadcast
export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });

  const { title, body, target_group, sender_id } = await req.json();
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Titel und Nachricht erforderlich' }, { status: 400 });
  }

  // 1. Get target profiles
  const profilesRes = await fetch(
    `${SUPA}/rest/v1/profiles?select=id,role,is_wirker,is_member&limit=5000`,
    { headers: H }
  );
  const allProfiles: Record<string,unknown>[] = await profilesRes.json().catch(() => []);

  let targets = allProfiles;
  if (target_group === 'wirker')    targets = allProfiles.filter(p => p.is_wirker);
  if (target_group === 'members')   targets = allProfiles.filter(p => p.is_member);
  if (target_group === 'admins')    targets = allProfiles.filter(p => ['admin','superadmin'].includes(p.role as string));
  if (target_group === 'basisuser') targets = allProfiles.filter(p => !p.is_wirker && !p.is_member);

  if (targets.length === 0) {
    return NextResponse.json({ error: 'Keine Nutzer in dieser Zielgruppe' }, { status: 400 });
  }

  const broadcastId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 2. Insert notifications in batches of 200
  const batchSize = 200;
  let sent = 0;

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    const rows = batch.map(u => ({
      user_id:   u.id,
      type:      'admin_broadcast',
      title:     title.trim(),
      body:      body.trim(),
      read:      false,       // used by HUI app
      is_read:   false,       // compatibility
      created_at: now,
      metadata: {
        broadcast_id: broadcastId,
        target_group: target_group || 'all',
        sent_count:   targets.length,
        sender_id:    sender_id || null,
      },
    }));

    const res = await fetch(`${SUPA}/rest/v1/notifications`, {
      method:  'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body:    JSON.stringify(rows),
    });
    if (res.ok) sent += batch.length;
    else {
      const err = await res.json().catch(() => null);
      console.error('[Broadcast] batch insert failed:', err);
    }
  }

  // 3. Log to notification_events (audit)
  try {
    await fetch(`${SUPA}/rest/v1/notification_events`, {
      method:  'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({
        type:           'admin_broadcast_sent',
        actor_id:       sender_id || null,
        target_user_id: null,
        metadata: {
          broadcast_id: broadcastId,
          title,
          target_group: target_group || 'all',
          sent_count:   sent,
        },
        created_at: now,
      }),
    });
  } catch (_) { /* non-critical */ }

  return NextResponse.json({
    ok:           true,
    broadcast_id: broadcastId,
    sent_count:   sent,
    target_group: target_group || 'all',
  });
}
