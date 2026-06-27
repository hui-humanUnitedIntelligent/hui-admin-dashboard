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
    const { id } = params;
    const body   = await req.json() as { action: string; reason?: string };
    const { action, reason } = body;
    const supabase = getServiceClient();
    const now = new Date().toISOString();

    // blocked_by = Admin-Blockiergrund (einzige existierende Text-Spalte für Grund)
    let profileUpdate: Record<string, unknown> = {};

    if (action === 'block') {
      profileUpdate = {
        blocked:    true,
        blocked_at: now,
        blocked_by: reason || 'Admin-Entscheidung',
      };
    } else if (action === 'unblock' || action === 'restore') {
      profileUpdate = {
        blocked:    false,
        blocked_at: null,
        blocked_by: null,
      };
    } else if (action === 'delete') {
      profileUpdate = {
        blocked:    true,
        blocked_at: now,
        blocked_by: reason || 'Konto gelöscht',
      };
    } else if (action === 'update_block_reason') {
      if (!reason) return ok({ ok: false, error: 'Kein Grund angegeben' });
      profileUpdate = { blocked_by: reason };
    } else {
      return ok({ ok: false, error: 'Unbekannte Aktion' });
    }

    const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', id);
    if (error) {
      console.error('[PATCH users] DB error:', error.message, '| update:', profileUpdate);
      throw error;
    }

    // Auth-User sperren (verhindert Login-Token-Refresh)
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    if (supabaseUrl && serviceKey) {
      if (action === 'block' || action === 'delete') {
        try {
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ban_duration: '87600h' }),
          });
        } catch (e) { console.warn('[PATCH] auth ban failed:', e); }
      }
      if (action === 'unblock' || action === 'restore') {
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
        } catch (e) { console.warn('[PATCH] auth unban failed:', e); }
      }
    }

    return ok({ ok: true, action, id });

  } catch (err) {
    console.error('[PATCH users]', err);
    return serverError(err instanceof Error ? err.message : String(err));
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
    const supabase   = getServiceClient();
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    // Profil löschen
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;

    // Auth-User löschen
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
      });
    }

    return ok({ ok: true, deleted: id });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : String(err));
  }
}
