// frontend/src/app/api/broadcast/route.ts
import { NextRequest } from 'next/server';
import { guardSuperAdmin, guardSuperAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient, getAnonClient } from '@/app/lib/supabase-server';
import { NOTIFICATION_TYPES } from '@/lib/notification-types';

type Profile = { id: string; role: string; is_wirker: boolean; is_member: boolean };

export async function GET(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const sb     = getServiceClient();
    const action = new URL(req.url).searchParams.get('action') || 'list';

    if (action === 'stats') {
      const [{ data: profiles }, { data: broadcasts }] = await Promise.all([
        sb.from('profiles').select('id,role,is_wirker,is_member').limit(2000),
        sb.from('notifications').select('metadata').eq('type', NOTIFICATION_TYPES.BROADCAST).limit(2000),
      ]);
      const p = (profiles ?? []) as Profile[];
      const broadcastIds = new Set<string>(
        (broadcasts ?? []).map(n => (n.metadata as Record<string,unknown>)?.broadcast_id as string).filter(Boolean)
      );
      return ok({
        totalUsers:      p.length,
        wirker:          p.filter(x => x.is_wirker).length,
        members:         p.filter(x => x.is_member).length,
        admins:          p.filter(x => ['admin','superadmin'].includes(x.role)).length,
        totalBroadcasts: broadcastIds.size,
      });
    }

    if (action === 'list') {
      const { data, error } = await sb
        .from('notifications')
        .select('id,title,body,created_at,metadata')
        .eq('type', NOTIFICATION_TYPES.BROADCAST)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const seen = new Set<string>();
      const broadcasts: unknown[] = [];
      for (const n of (data ?? [])) {
        const meta = n.metadata as Record<string,unknown>;
        const bid  = meta?.broadcast_id as string;
        if (bid && !seen.has(bid)) {
          seen.add(bid);
          broadcasts.push({
            id:          bid,
            title:       n.title,
            body:        n.body,
            createdAt:   n.created_at,
            targetGroup: meta?.target_group || 'all',
            sentCount:   meta?.sent_count   || 0,
          });
        }
      }
      return ok(broadcasts);
    }

    return fail(`Unbekannte Aktion: ${action}`);
  } catch (err) { return serverError(err, 'broadcast GET'); }
}

export async function POST(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const { title, body: msgBody, targetGroup, senderId } = body as {
      title?: string; body?: string; targetGroup?: string; senderId?: string;
    };

    if (!title?.trim())   return validationError({ title:   'Pflichtfeld' });
    if (!msgBody?.trim()) return validationError({ body:    'Pflichtfeld' });

    const sb = getServiceClient();
    const { data: profiles } = await sb.from('profiles').select('id,role,is_wirker,is_member').limit(5000);
    let targets = (profiles ?? []) as Profile[];
    if (targetGroup === 'wirker')    targets = targets.filter(p => p.is_wirker);
    if (targetGroup === 'members')   targets = targets.filter(p => p.is_member);
    if (targetGroup === 'admins')    targets = targets.filter(p => ['admin','superadmin'].includes(p.role));
    if (targetGroup === 'basisuser') targets = targets.filter(p => !p.is_wirker && !p.is_member);

    if (!targets.length) return fail('Keine Nutzer in dieser Zielgruppe');

    const broadcastId = crypto.randomUUID();
    const now         = new Date().toISOString();
    let sent          = 0;
    const batchSize   = 200;

    for (let i = 0; i < targets.length; i += batchSize) {
      const rows = targets.slice(i, i + batchSize).map(u => ({
        user_id: u.id, type: NOTIFICATION_TYPES.BROADCAST,
        title: title.trim(), body: msgBody.trim(), message: msgBody.trim(),
        read: false, is_read: false, created_at: now,
        metadata: { broadcastId, targetGroup: targetGroup ?? 'all', sentCount: targets.length, senderId: senderId ?? null },
      }));
      const { error } = await sb.from('notifications').insert(rows);
      if (!error) sent += rows.length;
    }

    // Activity Log — Broadcast gesendet
    try {
      const authH = req.headers.get('Authorization') ?? '';
      const tok   = authH.replace('Bearer ', '');
      const { data: { user: adminUser } } = await getAnonClient().auth.getUser(tok);
      await sb.from('activity_logs').insert({
        action:    'broadcast_sent',
        actor_id:  adminUser?.id ?? senderId ?? null,
        target_id: null,
        metadata:  { broadcastId, title: title.trim(), targetGroup: targetGroup ?? 'all', sentCount: sent },
        created_at: now,
      });
    } catch (_) {}

    return ok({ broadcastId, sentCount: sent, targetGroup: targetGroup ?? 'all' });
  } catch (err) { return serverError(err, 'broadcast POST'); }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const broadcastId = new URL(req.url).searchParams.get('broadcastId');
    if (!broadcastId) return validationError({ broadcastId: 'Pflichtfeld' });

    const sb = getServiceClient();
    const { data, error: fetchErr } = await sb
      .from('notifications').select('id,metadata').eq('type', NOTIFICATION_TYPES.BROADCAST);
    if (fetchErr) throw fetchErr;

    const ids = (data ?? [])
      .filter(n => (n.metadata as Record<string,unknown>)?.broadcastId === broadcastId
               ||  (n.metadata as Record<string,unknown>)?.broadcast_id === broadcastId)
      .map(n => n.id as string);

    if (!ids.length) return ok({ deletedCount: 0 });

    const batchSize = 200;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += batchSize) {
      const { error } = await sb.from('notifications').delete().in('id', ids.slice(i, i + batchSize));
      if (!error) deleted += Math.min(batchSize, ids.length - i);
    }
    try {
      const authH = req.headers.get('Authorization') ?? '';
      const tok   = authH.replace('Bearer ', '');
      const { data: { user: adminUser } } = await getAnonClient().auth.getUser(tok);
      await sb.from('activity_logs').insert({
        action: 'broadcast_deleted', actor_id: adminUser?.id ?? null, target_id: null,
        metadata: { broadcastId, deletedCount: deleted }, created_at: new Date().toISOString(),
      });
    } catch (_) {}
    return ok({ deletedCount: deleted });
  } catch (err) { return serverError(err, 'broadcast DELETE'); }
}
