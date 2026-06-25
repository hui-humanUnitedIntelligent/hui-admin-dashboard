// frontend/src/app/api/notifications/[id]/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, notFound, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient, getAnonClient } from '@/app/lib/supabase-server';

// ── PATCH: Einzelne Notification aktualisieren (z.B. mark-as-read) ───────────
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const { id } = params;
  if (!id) return validationError({ id: 'Pflichtfeld' });

  try {
    const body   = await req.json().catch(() => ({}));
    const sb     = getServiceClient();
    const now    = new Date().toISOString();

    // Snapshot vorher
    const { data: before } = await sb
      .from('notifications').select('id,is_read,type,user_id').eq('id', id).single();
    if (!before) return notFound('Notification');

    // Erlaubte Update-Felder
    const allowed: Record<string, unknown> = {};
    if (typeof body.is_read === 'boolean') {
      allowed.is_read = body.is_read;
      allowed.read    = body.is_read;  // beide Felder synchron halten
    }
    if (body.metadata !== undefined) allowed.metadata = body.metadata;

    if (!Object.keys(allowed).length) return validationError({ body: 'Keine gültigen Felder' });

    const { data: after, error } = await sb
      .from('notifications').update(allowed).eq('id', id).select().single();
    if (error) throw error;

    // Activity Log (nur bei is_read Änderung)
    if ('is_read' in allowed) {
      try {
        const authHeader = req.headers.get('Authorization') ?? '';
        const token      = authHeader.replace('Bearer ', '');
        const anonSb     = getAnonClient();
        const { data: { user } } = await anonSb.auth.getUser(token);
        await sb.from('activity_logs').insert({
          action:    allowed.is_read ? 'notification_read' : 'notification_unread',
          actor_id:  user?.id ?? before.user_id,
          target_id: id,
          metadata:  { before: { is_read: before.is_read }, after: { is_read: allowed.is_read }, type: before.type },
          created_at: now,
        });
      } catch (_) {}
    }

    return ok(after);
  } catch (err) { return serverError(err, 'notifications PATCH'); }
}

// ── DELETE: Einzelne Notification löschen ────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const { id } = params;
  if (!id) return validationError({ id: 'Pflichtfeld' });

  try {
    const sb  = getServiceClient();
    const now = new Date().toISOString();

    // Snapshot vorher
    const { data: existing } = await sb
      .from('notifications').select('id,type,user_id,title').eq('id', id).single();

    const { error } = await sb.from('notifications').delete().eq('id', id);
    if (error) throw error;

    // Activity Log
    try {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token      = authHeader.replace('Bearer ', '');
      const anonSb     = getAnonClient();
      const { data: { user } } = await anonSb.auth.getUser(token);
      await sb.from('activity_logs').insert({
        action:    'notification_deleted',
        actor_id:  user?.id ?? null,
        target_id: id,
        metadata:  { before: { type: existing?.type, title: existing?.title, user_id: existing?.user_id } },
        created_at: now,
      });
    } catch (_) {}

    return ok({ deleted: true, id });
  } catch (err) { return serverError(err, 'notifications DELETE'); }
}
