// frontend/src/app/api/employee/reasons/delete/route.ts
// POST /api/employee/reasons/delete — Soft-Delete (Employee only)
// Setzt status=deleted, deleted_by, deleted_at — KEIN Hard-Delete
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee, getAuthUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function POST(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  const user = await getAuthUser(req);

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'Keine ID' }, { status: 400 });

    const sb = getServiceClient();
    const { error } = await sb
      .from('impact_score_failures')
      .update({
        status: 'deleted',
        deleted_by: user?.id ?? null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return ok({ message: 'Soft-Delete erfolgreich', id });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'Fehler');
  }
}
