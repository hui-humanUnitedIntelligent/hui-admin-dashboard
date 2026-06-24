// frontend/src/app/api/notifications/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, created, fail, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const { title, message, type, targetGroup, targetUserId } =
      body as {
        title?: string;
        message?: string;
        type?: string;
        targetGroup?: string;
        targetUserId?: string;
      };

    if (!message?.trim()) return validationError({ message: 'Pflichtfeld' });

    const supabase = getServiceClient();

    // Zielgruppe ermitteln
    let userIds: string[] = [];
    if (targetUserId) {
      userIds = [targetUserId];
    } else {
      let query = supabase.from('profiles').select('id');
      if (targetGroup === 'wirker')   query = query.eq('is_wirker', true);
      if (targetGroup === 'member')   query = query.eq('is_member', true);
      if (targetGroup === 'admin')    query = query.eq('role', 'admin');
      const { data, error } = await query.limit(5000);
      if (error) throw error;
      userIds = (data ?? []).map(p => p.id);
    }

    if (!userIds.length) return fail('Keine Zielnutzer gefunden');

    const rows = userIds.map(userId => ({
      user_id:      userId,
      title:        title ?? 'HUI Nachricht',
      message:      message.trim(),
      type:         type ?? 'admin_broadcast',
      is_read:      false,
      read:         false,
    }));

    const { data, error } = await supabase.from('notifications').insert(rows).select();
    if (error) throw error;

    return created({ sent: data?.length ?? 0, recipients: userIds.length });
  } catch (err) {
    return serverError(err, 'notifications POST');
  }
}
