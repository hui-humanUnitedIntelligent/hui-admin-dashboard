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
  | 'hard_delete_work'
  | 'hard_delete_user';

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
      result = await sbPatch('profiles', userId, {
        blocked:    true,
        blocked_at: new Date().toISOString(),
        blocked_by: data.adminId as string || 'admin',
      });
      break;

    case 'unblock_user':
      result = await sbPatch('profiles', userId, {
        blocked:    false,
        blocked_at: null,
        blocked_by: null,
      });
      break;

    case 'delete_user': {
      // ── Hard Delete: alle Nutzerdaten vollständig entfernen ────────
      const delFromTable = async (table: string, col: string = 'user_id') => {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${userId}`, {
          method: 'DELETE',
          headers: {
            apikey:        SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            Prefer:        'return=minimal',
          },
        });
      };
      // Reihenfolge: abhängige Tabellen zuerst, dann Profile, dann Auth-User
      await Promise.all([
        delFromTable('works'),
        delFromTable('works_media'),
        delFromTable('works_engagement'),
        delFromTable('experiences'),
        delFromTable('experiences_media'),
        delFromTable('ambassador_ref_links'),
        delFromTable('ambassador_stats'),
        delFromTable('ambassador_transactions'),
        delFromTable('ambassadors_applications'),
        delFromTable('bookings'),
        delFromTable('payments'),
        delFromTable('impact_pool_entries'),
        delFromTable('profile_modules', 'id'),
        delFromTable('wirker_profiles'),
        delFromTable('notification_events'),
        delFromTable('notifications'),
      ]);
      // Profile löschen
      await sbHardDelete('profiles', userId);
      // Auth-User löschen (Supabase Admin API)
      const authDeleteRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
        {
          method: 'DELETE',
          headers: {
            apikey:        SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      result = { ok: authDeleteRes.ok, status: authDeleteRes.status, body: null };
      break;
    }

    case 'change_role':
      result = await sbPatch('profiles', userId, { role: data.role });
      break;

    case 'change_group':
      result = await sbPatch('profiles', userId, {
        membership_type:  data.group,
        is_wirker:        data.group === 'wirker' || data.group === 'talent',
        is_talent:        data.group === 'talent',
        membership_active:data.group === 'talent' ? true : false,
        talent_since:     data.group === 'talent' ? new Date().toISOString() : null,
        talent_activated_at: data.group === 'talent' ? new Date().toISOString() : null,
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

    case 'approve_work': {
      // Werk freigeben: approval_status='approved', status='published', sofort live
      result = await sbPatch('works', userId, {
        approval_status:   'approved',
        rejection_reason:  null,
        status:            'published',
        visibility:        'public',
        published_at:      new Date().toISOString(),
        last_submitted_at: null,
      });
      // Nutzer benachrichtigen: Werk freigegeben
      try {
        // Werk-Daten holen für Nutzerprofil
        const wRes = await fetch(`${SUPABASE_URL}/rest/v1/works?select=user_id,title&id=eq.${userId}&limit=1`, {
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
        });
        if (wRes.ok) {
          const [werk] = await wRes.json() as { user_id: string; title: string }[];
          if (werk?.user_id) {
            await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
              method: 'POST',
              headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({
                user_id:  werk.user_id,
                type:     'work_approved',
                title:    '✅ Dein Werk wurde freigegeben!',
                message:  `„${werk.title || 'Dein Werk'}" ist jetzt öffentlich sichtbar.`,
                work_id:  userId,
                read:     false,
              }),
            });
          }
        }
      } catch (_) { /* Benachrichtigung nicht kritisch */ }
      break;
    }

    case 'reject_work': {
      const rejectReason = (data.reason as string) || 'Nicht genehmigt';
      // Werk ablehnen: approval_status='rejected', unsichtbar
      result = await sbPatch('works', userId, {
        approval_status:  'rejected',
        rejection_reason: rejectReason,
        status:           'rejected',
        visibility:       'private',
        rejected_at:      new Date().toISOString(),
      });
      // Nutzer benachrichtigen: Werk abgelehnt
      try {
        const wRes = await fetch(`${SUPABASE_URL}/rest/v1/works?select=user_id,title&id=eq.${userId}&limit=1`, {
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
        });
        if (wRes.ok) {
          const [werk] = await wRes.json() as { user_id: string; title: string }[];
          if (werk?.user_id) {
            await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
              method: 'POST',
              headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({
                user_id:  werk.user_id,
                type:     'work_rejected',
                title:    '❌ Dein Werk wurde abgelehnt',
                message:  rejectReason,
                work_id:  userId,
                read:     false,
              }),
            });
          }
        }
      } catch (_) { /* Benachrichtigung nicht kritisch */ }
      break;
    }

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
