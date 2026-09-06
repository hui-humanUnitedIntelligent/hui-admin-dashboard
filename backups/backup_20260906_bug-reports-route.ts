// frontend/src/app/api/bug-reports/route.ts
// ── Bug Reports Admin API (2026-08-19) ───────────────────────────────────────
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return fail(error.message, 500);
    return ok(data || []);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id || typeof id !== 'string') return fail('ID fehlt', 400);

    const client = getServiceClient();

    if (action === 'update_status') {
      const { status } = body;
      if (!['offen', 'in_bearbeitung', 'gelöst'].includes(status)) {
        return fail('Ungültiger Status', 400);
      }
      const { data, error } = await client
        .from('bug_reports')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, status')
        .single();
      if (error) return fail(error.message, 500);
      return ok(data);
    }

    return fail('Unbekannte Aktion', 400);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const { id } = body;
    if (!id || typeof id !== 'string') return fail('ID fehlt', 400);

    const client = getServiceClient();
    const { error } = await client.from('bug_reports').delete().eq('id', id);
    if (error) return fail(error.message, 500);

    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
