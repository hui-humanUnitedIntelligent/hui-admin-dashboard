// frontend/src/app/api/users/[id]/route.ts
// PATCH /api/users/:id — block, unblock, delete, restore
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { id }    = params;
    const { action } = await req.json() as { action: string };
    const supabase  = getServiceClient();

    let profileUpdate: Record<string, unknown> = {};

    if (action === 'block') {
      profileUpdate = { blocked: true, blocked_at: new Date().toISOString() };
    } else if (action === 'unblock') {
      profileUpdate = { blocked: false, blocked_at: null, blocked_by: null };
    } else if (action === 'delete') {
      profileUpdate = { is_deleted: true, deleted_at: new Date().toISOString() };
    } else if (action === 'restore') {
      profileUpdate = { is_deleted: false, deleted_at: null, blocked: false };
    } else {
      return ok({ ok: false, error: 'Unbekannte Aktion' });
    }

    const { error } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', id);

    if (error) throw error;

    return ok({ ok: true, action, id });
  } catch (err) {
    return serverError(err, 'users PATCH');
  }
}
