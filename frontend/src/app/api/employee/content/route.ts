// frontend/src/app/api/employee/content/route.ts
// ── Employee Content Mutation API ──────────────────────────────────────────
// Identische Logik wie /api/admin, ABER:
// - guardEmployee statt guardSuperAdmin
// - KEIN Hard-Delete
// - KEIN user management
// - Nur Content-Mutations (works, experiences, projects, memberships, impact)

import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee, getAuthUser } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

type EmployeeAction =
  // Works
  | 'approve_work'
  | 'reject_work'
  | 'unpublish_work'
  | 'publish_work'
  | 'flag_work'
  | 'unflag_work'
  | 'update_work'
  | 'soft_delete_work'
  | 'mark_sensitive_work'
  | 'clear_sensitive_work'
  | 'set_comment_work'
  // Experiences
  | 'approve_experience'
  | 'reject_experience'
  | 'soft_delete_experience'
  | 'mark_sensitive_experience'
  | 'clear_sensitive_experience'
  | 'set_comment_experience'
  // Projects
  | 'approve_project'
  | 'reject_project'
  | 'soft_delete_project'
  | 'mark_sensitive_project'
  | 'clear_sensitive_project'
  | 'set_comment_project'
  // Memberships
  | 'update_membership'
  | 'deactivate_membership'
  | 'soft_delete_membership'
  // Impact
  | 'update_impact'
  | 'soft_delete_impact'
  // Score Failures
  | 'soft_delete_reason';

async function sbPatch(table: string, id: string, data: Record<string, unknown>) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey:         SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=representation',
    },
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

async function sendNotification(userId: string, payload: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ ...payload, user_id: userId, is_read: false }),
    });
  } catch { /* non-critical */ }
}

async function getEntry(table: string, id: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=user_id,title&id=eq.${id}&limit=1`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json() as { user_id: string; title: string }[];
  return rows[0] ?? null;
}

export async function POST(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  const employee = await getAuthUser(req);
  const now = new Date().toISOString();

  if (!SUPABASE_SERVICE_KEY) return fail('Service key not configured', 500);

  let body: { action: EmployeeAction; id: string; data?: Record<string, unknown> };
  try { body = await req.json(); }
  catch { return fail('Invalid JSON'); }

  const { action, id, data = {} } = body;
  if (!action || !id) return fail('Missing action or id');

  let result: { ok: boolean; status: number; body: unknown } = { ok: false, status: 500, body: null };

  switch (action) {

    // ── WORKS ──────────────────────────────────────────────────────────────
    case 'approve_work': {
      result = await sbPatch('works', id, {
        approval_status:  'approved',
        rejection_reason: null,
        status:           'published',
        visibility:       'public',
        published_at:     now,
        last_submitted_at: null,
        is_update:        false,
      });
      const entry = await getEntry('works', id);
      if (entry?.user_id) await sendNotification(entry.user_id, {
        type: 'work_approved',
        title: '✅ Dein Werk wurde freigegeben!',
        body: `„${entry.title || 'Dein Werk'}" ist jetzt öffentlich sichtbar.`,
        entity_id: id, entity_type: 'work',
        metadata: { werk_id: id, werk_title: entry.title },
      });
      break;
    }

    case 'reject_work': {
      const reason = (data.reason as string) || 'Nicht genehmigt';
      result = await sbPatch('works', id, {
        approval_status:  'rejected',
        rejection_reason: reason,
        status:           'rejected',
        visibility:       'private',
        rejected_at:      now,
      });
      const entry = await getEntry('works', id);
      if (entry?.user_id) await sendNotification(entry.user_id, {
        type: 'work_rejected',
        title: '❌ Dein Werk wurde abgelehnt',
        body: `„${entry.title || 'Dein Werk'}" wurde nicht freigegeben. Grund: ${reason}`,
        entity_id: id, entity_type: 'work',
        metadata: { werk_id: id, rejection_reason: reason },
      });
      break;
    }

    case 'publish_work':
      result = await sbPatch('works', id, { status: 'published', visibility: 'public', published_at: now });
      break;

    case 'unpublish_work':
      result = await sbPatch('works', id, { status: 'draft', visibility: 'private' });
      break;

    case 'flag_work':
      result = await sbPatch('works', id, { status: data.status || 'flagged', visibility: 'private' });
      break;

    case 'unflag_work':
      result = await sbPatch('works', id, { status: 'published', visibility: 'public' });
      break;

    case 'update_work':
      result = await sbPatch('works', id, {
        title:       data.title,
        description: data.description,
        category:    data.category,
        status:      data.status,
        visibility:  data.visibility,
      });
      break;

    case 'soft_delete_work':
      result = await sbPatch('works', id, {
        status:     'deleted',
        visibility: 'private',
        deleted_by: employee?.id ?? null,
        deleted_at: now,
      });
      break;

    case 'mark_sensitive_work':
      result = await sbPatch('works', id, {
        sensitivity_status: 'flagged',
        sensitivity_reason: (data.reason as string) || 'Manuell markiert',
        visibility: 'private',
      });
      break;

    case 'clear_sensitive_work':
      result = await sbPatch('works', id, { sensitivity_status: 'cleared', sensitivity_reason: null });
      break;

    case 'set_comment_work':
      result = await sbPatch('works', id, { admin_comment: data.comment });
      break;

    // ── EXPERIENCES ────────────────────────────────────────────────────────
    case 'approve_experience': {
      result = await sbPatch('experiences', id, {
        status:            'published',
        approval_status:   'approved',
        rejection_reason:  null,
        is_update:         false,
        last_submitted_at: null,
      });
      const entry = await getEntry('experiences', id);
      if (entry?.user_id) await sendNotification(entry.user_id, {
        type: 'experience_approved',
        title: '✅ Dein Erlebnis wurde freigegeben!',
        body: `„${entry.title || 'Dein Erlebnis'}" ist jetzt öffentlich sichtbar.`,
        entity_id: id, entity_type: 'experience',
      });
      break;
    }

    case 'reject_experience': {
      const reason = (data.reason as string) || 'Nicht genehmigt';
      result = await sbPatch('experiences', id, {
        status:           'rejected',
        approval_status:  'rejected',
        rejection_reason: reason,
        rejected_at:      now,
      });
      const entry = await getEntry('experiences', id);
      if (entry?.user_id) await sendNotification(entry.user_id, {
        type: 'experience_rejected',
        title: '❌ Dein Erlebnis wurde abgelehnt',
        body: `„${entry.title || 'Dein Erlebnis'}" wurde nicht freigegeben. Grund: ${reason}`,
        entity_id: id, entity_type: 'experience',
      });
      break;
    }

    case 'soft_delete_experience':
      result = await sbPatch('experiences', id, {
        approval_status: 'deleted',
        deleted_by:      employee?.id ?? null,
        deleted_at:      now,
      });
      break;

    case 'mark_sensitive_experience':
      result = await sbPatch('experiences', id, {
        sensitivity_status: 'flagged',
        sensitivity_reason: (data.reason as string) || 'Manuell markiert',
      });
      break;

    case 'clear_sensitive_experience':
      result = await sbPatch('experiences', id, { sensitivity_status: 'cleared', sensitivity_reason: null });
      break;

    case 'set_comment_experience':
      result = await sbPatch('experiences', id, { admin_comment: data.comment });
      break;

    // ── PROJECTS ───────────────────────────────────────────────────────────
    case 'approve_project': {
      result = await sbPatch('projects', id, {
        status: 'published', approval_status: 'approved',
        rejection_reason: null, is_update: false,
      });
      const entry = await getEntry('projects', id);
      if (entry?.user_id) await sendNotification(entry.user_id, {
        type: 'project_approved', title: '✅ Dein Projekt wurde freigegeben!',
        body: `„${entry.title || 'Dein Projekt'}" ist jetzt öffentlich sichtbar.`,
        entity_id: id, entity_type: 'project',
      });
      break;
    }

    case 'reject_project': {
      const reason = (data.reason as string) || 'Nicht genehmigt';
      result = await sbPatch('projects', id, {
        status: 'rejected', approval_status: 'rejected', rejection_reason: reason, rejected_at: now,
      });
      break;
    }

    case 'soft_delete_project':
      result = await sbPatch('projects', id, { approval_status: 'deleted', deleted_by: employee?.id, deleted_at: now });
      break;

    case 'mark_sensitive_project':
      result = await sbPatch('experiences', id, { sensitivity_status: 'flagged', sensitivity_reason: data.reason || 'Manuell markiert' });
      break;

    case 'clear_sensitive_project':
      result = await sbPatch('experiences', id, { sensitivity_status: 'cleared', sensitivity_reason: null });
      break;

    case 'set_comment_project':
      result = await sbPatch('experiences', id, { admin_comment: data.comment });
      break;

    // ── MEMBERSHIPS ────────────────────────────────────────────────────────
    case 'update_membership':
      result = await sbPatch('memberships', id, {
        membership_type: data.membership_type,
        vote_weight:     data.vote_weight,
        expires_at:      data.expires_at,
      });
      break;

    case 'deactivate_membership':
      result = await sbPatch('memberships', id, { status: 'inactive' });
      break;

    case 'soft_delete_membership':
      result = await sbPatch('memberships', id, { status: 'deleted', deleted_by: employee?.id, deleted_at: now });
      break;

    // ── IMPACT / SCORE FAILURES ────────────────────────────────────────────
    case 'update_impact':
      result = await sbPatch('impact_applications', id, {
        status:  data.status,
        comment: data.comment,
      });
      break;

    case 'soft_delete_impact':
      result = await sbPatch('impact_applications', id, { status: 'deleted', deleted_by: employee?.id, deleted_at: now });
      break;

    case 'soft_delete_reason':
      result = await sbPatch('impact_score_failures', id, { status: 'deleted', deleted_by: employee?.id, deleted_at: now });
      break;

    default:
      return fail('Unknown action');
  }

  if (result.ok) {
    return ok({ success: true, data: result.body });
  } else {
    return NextResponse.json(
      { error: 'Supabase error', details: result.body, status: result.status },
      { status: 500 }
    );
  }
}
