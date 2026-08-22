// frontend/src/app/api/system-errors/route.ts
// ── System Error Reports Admin API (2026-08-22) ─────────────────────────────
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const client = getServiceClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const priority = searchParams.get('priority') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    let query = client.from('system_error_reports').select('*').order('created_at', { ascending: false }).limit(limit);
    if (status !== 'all') query = query.eq('status', status);
    if (priority !== 'all') query = query.eq('priority', priority);
    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok(data || []);
  } catch (e) { return serverError(e, 'system-errors GET'); }
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
      if (!['new', 'investigating', 'resolved', 'ignored'].includes(status)) return fail('Ungültiger Status', 400);
      const { data, error } = await client.from('system_error_reports').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select('id, status').single();
      if (error) return fail(error.message, 500);
      return ok(data);
    }
    if (action === 'update_notes') {
      const { admin_notes } = body;
      const { data, error } = await client.from('system_error_reports').update({ admin_notes, updated_at: new Date().toISOString() }).eq('id', id).select('id, admin_notes').single();
      if (error) return fail(error.message, 500);
      return ok(data);
    }
    return fail('Unbekannte Aktion', 400);
  } catch (e) { return serverError(e, 'system-errors PATCH'); }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { id } = body;
    if (!id || typeof id !== 'string') return fail('ID fehlt', 400);
    const client = getServiceClient();
    const { error } = await client.from('system_error_reports').delete().eq('id', id);
    if (error) return fail(error.message, 500);
    return ok({ deleted: true });
  } catch (e) { return serverError(e, 'system-errors DELETE'); }
}
