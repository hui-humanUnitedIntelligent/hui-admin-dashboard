// frontend/src/app/api/bulk/route.ts
import { NextRequest } from 'next/server';
import { guardSuperAdmin, guardSuperAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function POST(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, userIds, data, adminId } = body as {
      action?: string; userIds?: string[]; data?: Record<string, unknown>; adminId?: string;
    };

    if (!Array.isArray(userIds) || userIds.length === 0)
      return validationError({ userIds: 'Mindestens eine User-ID erforderlich' });
    if (!action) return validationError({ action: 'Pflichtfeld' });

    const sb = getServiceClient();
    const now = new Date().toISOString();

    const patchUsers = async (patch: Record<string, unknown>) => {
      let success = 0; let failed = 0;
      for (const id of userIds) {
        const { error } = await sb.from('profiles').update({ ...patch, updated_at: now }).eq('id', id);
        error ? failed++ : success++;
      }
      return { success, failed };
    };

    const logActivity = async (actType: string, meta: Record<string, unknown>) => {
      try {
        await sb.from('activity_logs').insert({
          action: `admin_bulk_${actType}`,
          actor_id: adminId ?? null,
          metadata: { action: actType, targetIds: userIds, count: userIds.length, ...meta },
          created_at: now,
        });
      } catch (_) {}
    };

    switch (action) {
      case 'change_role': {
        const role = data?.role as string;
        if (!role) return validationError({ role: 'Pflichtfeld' });
        const res = await patchUsers({ role });
        await logActivity('change_role', { role });
        return ok(res);
      }
      case 'block': {
        const res = await patchUsers({ role: 'blocked', trust_score: -1 });
        await logActivity('block', {});
        return ok(res);
      }
      case 'unblock': {
        const res = await patchUsers({ role: 'basisuser', trust_score: 0 });
        await logActivity('unblock', {});
        return ok(res);
      }
      case 'delete': {
        const res = await patchUsers({ role: 'deleted', trust_score: -999, is_member: false });
        await logActivity('delete', {});
        return ok(res);
      }
      case 'broadcast': {
        const title   = data?.title   as string;
        const message = data?.body    as string;
        if (!title || !message) return validationError({ title: 'Pflichtfeld', body: 'Pflichtfeld' });
        const rows = userIds.map(userId => ({
          user_id: userId, type: 'admin_broadcast',
          title, message, is_read: false, read: false, created_at: now,
        }));
        const { error } = await sb.from('notifications').insert(rows);
        if (error) throw error;
        await logActivity('broadcast', { title });
        return ok({ sent: userIds.length });
      }
      case 'change_membership': {
        const membershipType = data?.membership_type as string;
        if (!membershipType) return validationError({ membershipType: 'Pflichtfeld' });
        const isMember = ['member','premium','wirker'].includes(membershipType);
        const res = await patchUsers({ membership_type: membershipType, is_member: isMember });
        await logActivity('change_membership', { membershipType });
        return ok(res);
      }
      default:
        return fail(`Unbekannte Aktion: ${action}`);
    }
  } catch (err) {
    return serverError(err, 'bulk POST');
  }
}
