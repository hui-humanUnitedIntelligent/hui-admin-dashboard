// frontend/src/app/api/bulk/route.ts
// Bulk-Aktionen auf mehreren User-IDs gleichzeitig

import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

async function patchUser(id: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

async function logActivity(action: string, targetIds: string[], meta: Record<string, unknown>) {
  try {
    await fetch(`${SUPA}/rest/v1/notification_events`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        type: `admin_bulk_${action}`,
        actor_id: meta.adminId || null,
        metadata: { action, target_ids: targetIds, count: targetIds.length, ...meta },
        created_at: new Date().toISOString(),
      }),
    });
  } catch (_) {}
}

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No key' }, { status: 500 });
  const { action, userIds, data, adminId } = await req.json();

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'userIds required' }, { status: 400 });
  }

  const results = { success: 0, failed: 0 };

  // ── change_role ──────────────────────────────────────────────────────────
  if (action === 'change_role') {
    const role = data?.role;
    if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 });
    for (const id of userIds) {
      const ok = await patchUser(id, { role });
      ok ? results.success++ : results.failed++;
    }
    await logActivity('change_role', userIds, { role, adminId });
    return NextResponse.json({ ok: true, ...results });
  }

  // ── block ────────────────────────────────────────────────────────────────
  if (action === 'block') {
    for (const id of userIds) {
      const ok = await patchUser(id, { role: 'blocked', trust_score: -1 });
      ok ? results.success++ : results.failed++;
    }
    await logActivity('block', userIds, { adminId });
    return NextResponse.json({ ok: true, ...results });
  }

  // ── unblock ──────────────────────────────────────────────────────────────
  if (action === 'unblock') {
    for (const id of userIds) {
      const ok = await patchUser(id, { role: 'basisuser', trust_score: 0 });
      ok ? results.success++ : results.failed++;
    }
    await logActivity('unblock', userIds, { adminId });
    return NextResponse.json({ ok: true, ...results });
  }

  // ── delete (soft) ────────────────────────────────────────────────────────
  if (action === 'delete') {
    for (const id of userIds) {
      const ok = await patchUser(id, { role: 'deleted', trust_score: -999, is_member: false, membership_active: false });
      ok ? results.success++ : results.failed++;
    }
    await logActivity('delete', userIds, { adminId });
    return NextResponse.json({ ok: true, ...results });
  }

  // ── broadcast (send notification to selected users) ──────────────────────
  if (action === 'broadcast') {
    const { title, body: msgBody } = data || {};
    if (!title || !msgBody) return NextResponse.json({ error: 'title and body required' }, { status: 400 });
    const now = new Date().toISOString();
    const rows = userIds.map(uid => ({
      user_id: uid, type: 'admin_broadcast', title, body: msgBody,
      is_read: false, created_at: now,
      metadata: { broadcast_id: crypto.randomUUID(), target_group: 'selected', sent_count: userIds.length },
    }));
    const res = await fetch(`${SUPA}/rest/v1/notifications`, {
      method: 'POST', headers: H, body: JSON.stringify(rows),
    });
    await logActivity('broadcast', userIds, { title, adminId });
    return NextResponse.json({ ok: res.ok, ...results, sent: userIds.length });
  }

  // ── change_membership ────────────────────────────────────────────────────
  if (action === 'change_membership') {
    const membership_type = data?.membership_type;
    if (!membership_type) return NextResponse.json({ error: 'membership_type required' }, { status: 400 });
    const is_member = ['member','premium','wirker'].includes(membership_type);
    for (const id of userIds) {
      const ok = await patchUser(id, { membership_type, is_member });
      ok ? results.success++ : results.failed++;
    }
    await logActivity('change_membership', userIds, { membership_type, adminId });
    return NextResponse.json({ ok: true, ...results });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
