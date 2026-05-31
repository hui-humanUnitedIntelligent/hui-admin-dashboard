// frontend/src/app/api/admin/route.ts
// ── HUI Admin — Server-Side Mutation API ─────────────────────────────────
// Uses SUPABASE_SERVICE_ROLE_KEY (server-only, never exposed to client)

import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Admin actions allowed
type Action =
  | 'block_user'
  | 'unblock_user'
  | 'delete_user'
  | 'change_role'
  | 'change_group'
  | 'edit_profile'
  | 'toggle_wirker';

async function sbPatch(table: string, id: string, data: Record<string, unknown>) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey:          SUPABASE_SERVICE_KEY,
      Authorization:   `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          'return=representation',
    },
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

async function logActivity(userId: string, action: string, meta: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/notification_events`, {
      method: 'POST',
      headers: {
        apikey:         SUPABASE_SERVICE_KEY,
        Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({
        user_id:    userId,
        event_type: `admin_${action}`,
        payload:    meta,
        created_at: new Date().toISOString(),
      }),
    });
  } catch {
    // log table may not exist — ignore
  }
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: 'Service key not configured' }, { status: 500 });
  }

  let body: { action: Action; userId: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, userId, data = {} } = body;
  if (!action || !userId) {
    return NextResponse.json({ error: 'Missing action or userId' }, { status: 400 });
  }

  let result: { ok: boolean; status: number; body: unknown };

  switch (action) {
    case 'block_user':
      result = await sbPatch('profiles', userId, { is_guardian: false, trust_score: -1, role: 'blocked' });
      break;

    case 'unblock_user':
      result = await sbPatch('profiles', userId, { trust_score: 0, role: data.previousRole as string || 'basisuser' });
      break;

    case 'delete_user':
      // Soft delete: set role to 'deleted' + trust_score = -999
      result = await sbPatch('profiles', userId, { role: 'deleted', trust_score: -999, is_member: false, membership_active: false });
      break;

    case 'change_role':
      result = await sbPatch('profiles', userId, { role: data.role });
      break;

    case 'change_group':
      result = await sbPatch('profiles', userId, {
        membership_type: data.group,
        is_wirker: data.group === 'wirker' || data.group === 'talent',
      });
      break;

    case 'edit_profile':
      result = await sbPatch('profiles', userId, {
        display_name: data.display_name,
        bio:          data.bio,
        location:     data.location,
        location_label: data.location,
        talent:       data.talent,
        is_available: data.is_available,
        skills:       data.skills,
        tagline:      data.tagline,
      });
      break;

    case 'toggle_wirker':
      result = await sbPatch('profiles', userId, { is_wirker: data.is_wirker });
      break;

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  if (result.ok) {
    await logActivity(userId, action, data);
    return NextResponse.json({ success: true, data: result.body });
  } else {
    return NextResponse.json(
      { error: 'Supabase error', details: result.body, status: result.status },
      { status: 500 }
    );
  }
}
