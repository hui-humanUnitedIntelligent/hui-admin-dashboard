// frontend/src/app/api/talent-offers/route.ts
// Talent-Angebote — neues Modul, NICHT zu verwechseln mit /api/talents (Talent-Pool).
// GET: Liste + Filter + Counts (Employee+Superadmin, Read-Only fuer Employee).
// PATCH: Freigeben/Ablehnen/Loeschen (nur Superadmin).
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee, guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';
import { ok, fail, serverError } from '@/app/lib/api-response';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all'; // pending|approved|rejected|all
    const category = searchParams.get('category') || '';
    const search = (searchParams.get('search') || '').toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sb = getServiceClient();

    let q = sb.from('talents').select('*', { count: 'exact' });
    if (status !== 'all') q = q.eq('status', status);
    if (category) q = q.eq('category', category);
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) return serverError(error, 'talent-offers GET');

    const userIds = [...new Set((data ?? []).map((t: { user_id: string }) => t.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await sb.from('profiles').select('id,display_name,username,avatar_url,email').in('id', userIds)
      : { data: [] };
    const profMap = new Map((profiles ?? []).map(p => [p.id, p]));

    let items = (data ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      author: profMap.get(t.user_id as string) ?? null,
    }));
    if (search) {
      items = items.filter((t) => {
        const title = String((t as Record<string, unknown>)['title'] ?? '').toLowerCase();
        const dname = String(((t as Record<string, unknown>)['author'] as Record<string, unknown> | null)?.['display_name'] ?? '').toLowerCase();
        return title.includes(search) || dname.includes(search);
      });
    }

    const [allCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      sb.from('talents').select('id', { count: 'exact', head: true }),
      sb.from('talents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('talents').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      sb.from('talents').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);

    return NextResponse.json({
      talents: items,
      total: count ?? 0,
      counts: {
        all: allCount.count ?? 0,
        pending: pendingCount.count ?? 0,
        approved: approvedCount.count ?? 0,
        rejected: rejectedCount.count ?? 0,
      },
    });
  } catch (err) {
    return serverError(err, 'talent-offers GET');
  }
}

// PATCH: approve_talent / reject_talent / delete_talent — Superadmin only
export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { id, _action, rejection_reason, reason } = body;
    if (!id) return fail('id erforderlich');

    const sb = getServiceClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (_action === 'approve_talent') {
      updates.status = 'approved';
      updates.rejection_reason = null;
      updates.reviewed_at = new Date().toISOString();
    } else if (_action === 'reject_talent') {
      updates.status = 'rejected';
      updates.rejection_reason = rejection_reason ?? reason ?? 'Nicht genehmigt';
      updates.reviewed_at = new Date().toISOString();
    } else if (_action === 'delete_talent') {
      const { error: delErr } = await sb.from('talents').delete().eq('id', id);
      if (delErr) return serverError(delErr, 'talent-offers DELETE');
      return ok({ message: 'Gelöscht', id });
    } else {
      return fail('Unbekannte Aktion');
    }

    const { data, error } = await sb.from('talents').update(updates).eq('id', id).select().single();
    if (error) return serverError(error, 'talent-offers PATCH');

    // Leichtgewichtiges Event-Log (notification_events, gleiches Muster wie andere Admin-Aktionen).
    // Kein Aufruf der Resonanz-/Matching-RPCs (compute_match_scores etc.) — die bleiben bewusst
    // unimplementiert (siehe Memory #467), hier nur ein einfacher Status-Change-Log.
    try {
      await sb.from('notification_events').insert({
        user_id: data.user_id,
        event_type: _action === 'approve_talent' ? 'talent_approved' : 'talent_rejected',
        payload: { talent_id: id, title: data.title, rejection_reason: data.rejection_reason ?? null },
        created_at: new Date().toISOString(),
      });
    } catch { /* Event-Log-Fehler nie den Request blockieren */ }

    return ok(data);
  } catch (err) {
    return serverError(err, 'talent-offers PATCH');
  }
}
