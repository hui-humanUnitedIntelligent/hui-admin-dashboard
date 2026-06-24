// frontend/src/app/api/impact-applications/[id]/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, notFound, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const { id } = params;
  if (!id) return validationError({ id: 'Pflichtfeld' });

  try {
    const body   = await req.json().catch(() => ({}));
    const fields = body as Record<string, unknown>;

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('impact_applications')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return notFound('Impact Application');
      throw error;
    }
    return ok(data);
  } catch (err) {
    return serverError(err, 'impact-applications PATCH');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const { id } = params;
  if (!id) return validationError({ id: 'Pflichtfeld' });

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from('impact_applications').delete().eq('id', id);
    if (error) throw error;
    return ok({ deleted: true, id });
  } catch (err) {
    return serverError(err, 'impact-applications DELETE');
  }
}
