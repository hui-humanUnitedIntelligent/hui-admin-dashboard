// frontend/src/app/api/users/[id]/route.ts
// PATCH /api/users/:id — block (mit Grund), unblock, delete, restore, update_block_reason
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
    const { id } = params;
    const body   = await req.json() as { action: string; reason?: string; admin_note?: string };
    const { action, reason, admin_note } = body;
    const supabase = getServiceClient();
    const now = new Date().toISOString();

    let profileUpdate: Record<string, unknown> = {};

    if (action === 'block') {
      profileUpdate = {
        blocked:       true,
        blocked_at:    now,
        blocked_by:    'admin',
        blocked_reason: reason || null,
      };
    } else if (action === 'unblock') {
      profileUpdate = {
        blocked:        false,
        blocked_at:     null,
        blocked_by:     null,
        blocked_reason: null,
      };
    } else if (action === 'delete') {
      profileUpdate = { blocked: true, blocked_at: now, blocked_reason: reason || 'Konto gelöscht' };
    } else if (action === 'restore') {
      profileUpdate = { blocked: false, blocked_at: null, blocked_by: null, blocked_reason: null };
    } else if (action === 'update_block_reason') {
      if (!reason && !admin_note) return ok({ ok: false, error: 'Kein Grund angegeben' });
      profileUpdate = { blocked_reason: reason || admin_note || null };
    } else {
      return ok({ ok: false, error: 'Unbekannte Aktion' });
    }

    const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', id);
    if (error) throw error;

    // Bei Block: Supabase Auth User sperren (verhindert Login)
    if (action === 'block' || action === 'delete') {
      const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      if (supabaseUrl && serviceKey) {
        try {
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ban_duration: '87600h' }), // 10 Jahre = effektiv dauerhaft
          });
        } catch { /* ignore auth ban error */ }
      }
    }

    // Bei Unblock/Restore: Auth Ban aufheben
    if (action === 'unblock' || action === 'restore') {
      const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      if (supabaseUrl && serviceKey) {
        try {
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ban_duration: 'none' }),
          });
        } catch { /* ignore */ }
      }
    }

    return ok({ ok: true, action, id });
  } catch (err) {
    return serverError(err, 'users PATCH');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { id } = params;
    const supabase = getServiceClient();
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    // Aus Auth löschen
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
      });
    }
    // Profile löschen
    await supabase.from('profiles').delete().eq('id', id);
    return ok({ ok: true, deleted: id });
  } catch (err) {
    return serverError(err, 'users DELETE');
  }
}
