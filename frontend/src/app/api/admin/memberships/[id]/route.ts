// frontend/src/app/api/admin/memberships/[id]/route.ts
// DELETE /api/admin/memberships/[id] — Hard-Delete (Superadmin only)
import { NextRequest, NextResponse } from 'next/server';
import { guardSuperAdmin } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  const { id } = params;
  if (!id) return NextResponse.json({ ok: false, error: 'Keine ID' }, { status: 400 });

  try {
    const sb = getServiceClient();

    // Datensatz vorher laden (für Medien)
    const { data: row } = await sb.from('memberships').select('*').eq('id', id).single();


    // Hard-Delete
    const { error } = await sb.from('memberships').delete().eq('id', id);
    if (error) throw error;

    return ok({ message: 'Endgültig gelöscht', id });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'Fehler');
  }
}
