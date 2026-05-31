// frontend/src/app/api/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function sbFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    headers: H,
    ...opts,
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

// GET — list past broadcasts (stored in notifications with type=admin_broadcast)
export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    // Fetch distinct broadcasts from notification_events metadata
    // We store broadcast records as notifications with type='admin_broadcast' for user_id=null workaround
    // Actually: we'll use a query to get unique broadcasts from notifications
    const url = `${SUPA}/rest/v1/notifications?type=eq.admin_broadcast&order=created_at.desc&limit=200&select=id,title,body,created_at,metadata`;
    const res = await fetch(url, { headers: H });
    const data = await res.json().catch(() => []);

    // De-duplicate by broadcast_id in metadata
    const seen = new Set<string>();
    const broadcasts: unknown[] = [];
    for (const n of (Array.isArray(data) ? data : [])) {
      const bid = (n.metadata as Record<string,unknown>)?.broadcast_id as string;
      if (bid && !seen.has(bid)) {
        seen.add(bid);
        const meta = n.metadata as Record<string,unknown>;
        broadcasts.push({
          id: bid,
          title: n.title,
          body: n.body,
          created_at: n.created_at,
          target_group: meta?.target_group || 'all',
          sent_count: meta?.sent_count || 0,
        });
      }
    }
    return NextResponse.json(broadcasts);
  }

  // Stats
  if (action === 'stats') {
    const [profiles, broadcasts] = await Promise.all([
      fetch(`${SUPA}/rest/v1/profiles?select=id,role,is_wirker,is_member&limit=1000`, { headers: H }).then(r => r.json()).catch(() => []),
      fetch(`${SUPA}/rest/v1/notifications?type=eq.admin_broadcast&select=id&limit=1000`, { headers: H }).then(r => r.json()).catch(() => []),
    ]);
    const p = Array.isArray(profiles) ? profiles : [];
    return NextResponse.json({
      total_users: p.length,
      wirker: p.filter((x: Record<string,unknown>) => x.is_wirker).length,
      members: p.filter((x: Record<string,unknown>) => x.is_member).length,
      admins: p.filter((x: Record<string,unknown>) => ['admin','superadmin'].includes(x.role as string)).length,
      total_broadcasts: Array.isArray(broadcasts) ? broadcasts.length : 0,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// POST — send a broadcast
export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No service key' }, { status: 500 });

  const { title, body, target_group, sender_id } = await req.json();
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 });
  }

  // 1. Get target users
  const profilesRes = await fetch(
    `${SUPA}/rest/v1/profiles?select=id,role,is_wirker,is_member&limit=2000`,
    { headers: H }
  );
  const allProfiles: Record<string,unknown>[] = await profilesRes.json().catch(() => []);

  let targets = allProfiles;
  if (target_group === 'wirker')  targets = allProfiles.filter(p => p.is_wirker);
  if (target_group === 'members') targets = allProfiles.filter(p => p.is_member);
  if (target_group === 'admins')  targets = allProfiles.filter(p => ['admin','superadmin'].includes(p.role as string));
  if (target_group === 'basisuser') targets = allProfiles.filter(p => !p.is_wirker && !p.is_member);

  if (targets.length === 0) {
    return NextResponse.json({ error: 'No users in target group' }, { status: 400 });
  }

  const broadcastId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 2. Insert a notification for each target user in batches of 100
  const batchSize = 100;
  let sent = 0;

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    const rows = batch.map(u => ({
      user_id:    u.id,
      type:       'admin_broadcast',
      title,
      body,
      is_read:    false,
      created_at: now,
      metadata:   {
        broadcast_id: broadcastId,
        target_group,
        sent_count: targets.length,
        sender_id,
      },
    }));

    const res = await fetch(`${SUPA}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    });
    if (res.ok) sent += batch.length;
  }

  // 3. Log to activity_logs
  try {
    await fetch(`${SUPA}/rest/v1/notification_events`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({
        type: 'admin_broadcast_sent',
        actor_id: sender_id,
        target_user_id: null,
        metadata: { broadcast_id: broadcastId, title, target_group, sent_count: sent },
        created_at: now,
      }),
    });
  } catch (_) {}

  return NextResponse.json({ ok: true, broadcast_id: broadcastId, sent_count: sent });
}
