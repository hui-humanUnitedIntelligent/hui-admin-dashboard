// frontend/src/app/api/impact-applications/[id]/route.ts
import { NextRequest } from 'next/server';
import { guardSuperAdmin } from '@/app/lib/auth-guard';
import { ok, notFound, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

import { APPLICATION_STATUS, ApplicationStatus, ALLOWED_STATUS_TRANSITIONS } from '@/lib/impact-status';
// ─────────────────────────────────────────────────────────────────────────────

// ── PATCH: Status-Update + activity_log ─────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  const { id } = params;
  if (!id) return validationError({ id: 'Pflichtfeld' });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      status,
      rejection_reason,
      admin_comment,
      review_note,
    } = body as {
      status?:           ApplicationStatus;
      rejection_reason?: string;
      admin_comment?:    string;
      review_note?:      string;
      [key: string]: unknown;
    };

    const sb  = getServiceClient();
    const now = new Date().toISOString();

    // Aktuellen Datensatz laden (für Snapshot + Transitions-Validierung)
    const { data: existing, error: fetchErr } = await sb
      .from('impact_applications').select('*').eq('id', id).single();
    if (fetchErr || !existing) return notFound('Impact Application');

    // Status-Transition validieren
    if (status) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status as string] ?? [];
      if (!allowed.includes(status as ApplicationStatus)) {
        return validationError({
          status: `Übergang von '${existing.status}' → '${status}' nicht erlaubt`,
        });
      }
    }

    // Admin-User aus Auth-Header ermitteln
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const anonSb = (await import('@/app/lib/supabase-server')).getAnonClient();
    const { data: { user: adminUser } } = await anonSb.auth.getUser(token);
    const adminId = adminUser?.id ?? 'admin';

    // Update-Payload zusammenbauen
    const updatePayload: Record<string, unknown> = { updated_at: now };
    if (status) {
      updatePayload.status      = status;
      updatePayload.reviewed_at = now;
      updatePayload.reviewed_by = adminId;
    }
    if (rejection_reason !== undefined) updatePayload.rejection_reason = rejection_reason;
    if (admin_comment    !== undefined) updatePayload.admin_comment    = admin_comment;
    if (review_note      !== undefined) updatePayload.review_note      = review_note;
    if (status === 'rejected') updatePayload.rejected_at = now;

    // Update ausführen
    const { data, error } = await sb
      .from('impact_applications')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return notFound('Impact Application');
      throw error;
    }

    // Activity Log
    try {
      await sb.from('activity_logs').insert({
        action:    `impact_application_${status ?? 'updated'}`,
        actor_id:  adminId,
        target_id: id,
        metadata:  {
          before:           { status: existing.status, admin_comment: existing.admin_comment },
          after:            { status: data.status,     admin_comment: data.admin_comment },
          project_name:     existing.project_name,
          rejection_reason: rejection_reason ?? null,
        },
        created_at: now,
      });
    } catch (_) { /* Log-Fehler nicht kritisch */ }

    return ok(data);
  } catch (err) {
    return serverError(err, 'impact-applications PATCH');
  }
}

// ── DELETE: Hard-Delete + activity_log ───────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  const { id } = params;
  if (!id) return validationError({ id: 'Pflichtfeld' });

  try {
    const sb  = getServiceClient();
    const now = new Date().toISOString();

    // Snapshot vor dem Löschen
    const { data: existing } = await sb
      .from('impact_applications').select('id,project_name,user_id,status').eq('id', id).single();

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const anonSb = (await import('@/app/lib/supabase-server')).getAnonClient();
    const { data: { user: adminUser } } = await anonSb.auth.getUser(token);
    const adminId = adminUser?.id ?? 'admin';

    const { error } = await sb.from('impact_applications').delete().eq('id', id);
    if (error) throw error;

    // Activity Log
    try {
      await sb.from('activity_logs').insert({
        action:    'impact_application_deleted',
        actor_id:  adminId,
        target_id: id,
        metadata:  {
          project_name: existing?.project_name ?? 'unbekannt',
          user_id:      existing?.user_id      ?? null,
          status_before: existing?.status      ?? null,
        },
        created_at: now,
      });
    } catch (_) {}

    return ok({ deleted: true, id });
  } catch (err) {
    return serverError(err, 'impact-applications DELETE');
  }
}
