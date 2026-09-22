// frontend/src/app/api/admin/reasons/[id]/route.ts
// DELETE /api/admin/reasons/[id] — Hard-Delete (Superadmin only)
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

    // Hard-Delete mit Rückgabeprüfung: Supabase liefert bei einer unbekannten
    // ID sonst erfolgreich 0 gelöschte Zeilen, was die UI fälschlich als
    // erledigt anzeigen würde.
    const { data, error } = await sb
      .from('impact_score_failures')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: 'Eintrag nicht gefunden' }, { status: 404 });

    return ok({ message: 'Endgültig gelöscht', id: data.id });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'Fehler');
  }
}
