// frontend/src/app/api/notifications/[id]/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const { id } = params;
  if (!id) return validationError({ id: 'Pflichtfeld' });

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw error;
    return ok({ deleted: true, id });
  } catch (err) {
    return serverError(err, 'notifications DELETE');
  }
}
