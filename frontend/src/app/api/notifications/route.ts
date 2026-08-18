// frontend/src/app/api/notifications/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin, guardEmployee } from '@/app/lib/auth-guard';
import { ok, created, fail, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient, getAnonClient } from '@/app/lib/supabase-server';
import { NOTIFICATION_TYPES, isValidNotificationType } from '@/lib/notification-types';

// ── GET: Notifications abrufen (mit Paginierung + Filter) ────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const sb     = getServiceClient();
    const params = new URL(req.url).searchParams;
    const userId    = params.get('user_id');
    const type      = params.get('type');
    const unread    = params.get('unread') === 'true';
    const limit     = Math.min(Number(params.get('limit') ?? 100), 500);
    const skip      = Number(params.get('skip') ?? 0);

    let query = sb
      .from('notifications')
      .select('id,user_id,type,title,body,is_read,read,metadata,entity_id,entity_type,action_url,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (userId) query = query.eq('user_id', userId);
    if (type)   query = query.eq('type', type);
    if (unread) query = query.eq('is_read', false);

    const { data, error, count } = await query;
    if (error) throw error;

    const unreadCount = unread ? (count ?? 0) : await (async () => {
      let q = sb.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
      if (userId) q = q.eq('user_id', userId);
      const { count: uc } = await q;
      return uc ?? 0;
    })();

    return ok({ notifications: data ?? [], total: count ?? 0, unreadCount, hasMore: (skip + limit) < (count ?? 0) });
  } catch (err) { return serverError(err, 'notifications GET'); }
}

// ── POST: Notification senden ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));

    // Unterstütze: flaches Format { user_id, type, title, body } 
    // und gewrapptes Format { notification: { ... } }
    const payload = (body.notification ?? body) as {
      user_id?:      string;
      type?:         string;
      title?:        string;
      body?:         string;
      message?:      string;  // Alias für body
      entity_id?:    string;
      entity_type?:  string;
      action_url?:   string;
      metadata?:     Record<string, unknown>;
      is_read?:      boolean;
      read?:         boolean;
    };

    const { targetGroup, targetUserId } = body as { targetGroup?: string; targetUserId?: string };

    if (!payload.body?.trim() && !payload.message?.trim()) {
      return validationError({ body: 'body oder message ist Pflichtfeld' });
    }

    const sb  = getServiceClient();
    const now = new Date().toISOString();

    // Admin-ID aus Token
    const authHeader = req.headers.get('Authorization') ?? '';
    const token      = authHeader.replace('Bearer ', '');
    const anonSb     = getAnonClient();
    const { data: { user: adminUser } } = await anonSb.auth.getUser(token);
    const adminId    = adminUser?.id ?? null;

    // Ziel-User ermitteln
    let userIds: string[] = [];
    if (payload.user_id) {
      userIds = [payload.user_id];
    } else if (targetUserId) {
      userIds = [targetUserId];
    } else {
      let q = sb.from('profiles').select('id').not('email', 'like', '%hui-commerce.test%');
      if (targetGroup === 'wirker')    q = q.eq('is_wirker', true);
      if (targetGroup === 'member')    q = q.eq('is_member', true);
      if (targetGroup === 'members')   q = q.eq('is_member', true);
      if (targetGroup === 'admin')     q = q.eq('role', 'admin');
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      userIds = (data ?? []).map(p => p.id);
    }

    if (!userIds.length) return fail('Keine Zielnutzer gefunden');

    // Notification-Typ validieren
    const notifType = isValidNotificationType(payload.type ?? '') 
      ? payload.type! 
      : NOTIFICATION_TYPES.SYSTEM;
    const notifBody  = (payload.body ?? payload.message ?? '').trim();
    const notifTitle = (payload.title ?? 'HUI Nachricht').trim();

    const rows = userIds.map(uid => ({
      user_id:     uid,
      type:        notifType,
      title:       notifTitle,
      body:        notifBody,
      is_read:     false,
      read:        false,
      entity_id:   payload.entity_id    ?? null,
      entity_type: payload.entity_type  ?? null,
      action_url:  payload.action_url   ?? null,
      metadata:    payload.metadata     ?? null,
      created_at:  now,
    }));

    const batchSize = 200;
    let insertedCount = 0;
    let lastId: string | null = null;

    for (let i = 0; i < rows.length; i += batchSize) {
      const { data: inserted, error } = await sb
        .from('notifications').insert(rows.slice(i, i + batchSize)).select('id');
      if (!error) {
        insertedCount += inserted?.length ?? 0;
        if (i === 0 && inserted?.[0]?.id) lastId = inserted[0].id;
      }
    }

    // Activity Log
    try {
      await sb.from('activity_logs').insert({
        action:    'notification_sent',
        actor_id:  adminId,
        target_id: userIds.length === 1 ? userIds[0] : null,
        metadata:  { type: notifType, title: notifTitle, recipientCount: insertedCount, targetGroup: targetGroup ?? null },
        created_at: now,
      });
    } catch (_) {}

    return created({ sent: insertedCount, recipients: userIds.length, id: lastId });
  } catch (err) { return serverError(err, 'notifications POST'); }
}

// ── PATCH: Alle Notifications als gelesen markieren ──────────────────────────
export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const params = new URL(req.url).searchParams;
    const action  = params.get('action');
    const userId  = params.get('user_id');

    if (action !== 'mark_all_read') return fail(`Unbekannte Aktion: ${action}`);
    if (!userId) return validationError({ user_id: 'Pflichtfeld' });

    const sb  = getServiceClient();
    const now = new Date().toISOString();

    const { count: beforeCount } = await sb
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    const { error } = await sb
      .from('notifications')
      .update({ is_read: true, read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    const count = beforeCount ?? 0;
    if (error) throw error;

    try {
      await sb.from('activity_logs').insert({
        action:    'notifications_mark_all_read',
        actor_id:  userId,
        target_id: userId,
        metadata:  { updatedCount: count ?? 0 },
        created_at: now,
      });
    } catch (_) {}

    return ok({ markedRead: count ?? 0 });
  } catch (err) { return serverError(err, 'notifications PATCH'); }
}
