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
  | 'toggle_wirker'
  | 'update_work'
  | 'unpublish_work'
  | 'delete_work'
  | 'flag_work'
  | 'approve_work'
  | 'reject_work'
  | 'restore_work'
  | 'unflag_work'
  | 'restore_user'
  | 'hard_delete_work';

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

async function sbHardDelete(table: string, id: string) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey:         SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer:         'return=minimal',
    },
  });
  return { ok: res.ok, status: res.status, body: null };
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

    // ── Work actions ────────────────────────────────────────────────────────
    case 'unpublish_work':
      result = await sbPatch('works', userId, { status: 'draft', visibility: 'private' });
      break;

    case 'approve_work':
      result = await sbPatch('works', userId, {
        status: 'published',
        visibility: 'public',
        published: true,
        visible: true,
        published_at: new Date().toISOString(),
      });
      break;

    case 'reject_work':
      result = await sbPatch('works', userId, {
        status: 'rejected',
        visibility: 'private',
        published: false,
        visible: false,
        rejected_at: new Date().toISOString(),
        rejection_reason: (data.reason as string) || 'Nicht genehmigt',
        rejected_at: new Date().toISOString(),
      });
      break;

    case 'flag_work':
      result = await sbPatch('works', userId, {
        status: data.status || 'flagged',
        visibility: 'private',
      });
      break;

    case 'delete_work':
      result = await sbPatch('works', userId, { status: 'deleted', visibility: 'private' });
      break;

    case 'update_work':
      result = await sbPatch('works', userId, {
        title:              data.title,
        description:        data.description,
        caption:            data.caption,
        category:           data.category,
        tags:               data.tags,
        price:              data.price,
        price_eur:          data.price_eur,
        status:             data.status,
        visibility:         data.visibility,
        allow_comments:     data.allow_comments,
        allow_likes:        data.allow_likes,
        allow_shares:       data.allow_shares,
        for_sale:           data.for_sale,
        is_showcase_only:   data.is_showcase_only,
        location_text:      data.location_text,
      });
      break;

    case 'restore_work':
      // Restore soft-deleted work → published + public (immediately visible in app)
      result = await sbPatch('works', userId, { status: 'published', visibility: 'public' });
      break;

    case 'unflag_work':
      // Remove flag, set back to published + public
      result = await sbPatch('works', userId, { status: 'published', visibility: 'public' });
      break;

    case 'restore_user':
      // Restore soft-deleted user: reset trust_score to 0, set role to basisuser
      result = await sbPatch('profiles', userId, {
        trust_score: 0,
        role: data.role as string || 'basisuser',
        is_member: true,
        membership_active: false,
      });
      break;

    case 'hard_delete_work':
      // Permanently delete a work from the database (irreversible)
      result = await sbHardDelete('works', userId);
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

// ── GET handler — simple table read for dashboard widgets ─────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const table  = searchParams.get('table')  || '';
  const select = searchParams.get('select') || '*';
  const limit  = searchParams.get('limit')  || '500';

  const ALLOWED_TABLES = ['works','profiles','payments','impact_projects','bookings','wirker_profiles','wirker','activity_logs','notifications','invitations','orders'];
  if (!table || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
  }

  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${limit}`;
  const resp = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  const data = await resp.json();
  if (!resp.ok) return NextResponse.json({ error: 'Supabase error', details: data }, { status: resp.status });
  return NextResponse.json(data);
}
