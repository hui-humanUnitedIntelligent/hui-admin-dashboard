// frontend/src/app/api/works/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee, guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

// Alle Status-Werte die als "eingereicht" gelten
const SUBMITTED_STATES = ['submitted', 'pending', 'pending_review', 'review', 'waiting_for_approval'];

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const filter  = searchParams.get('filter') || 'all';
    const search  = (searchParams.get('search') || '').toLowerCase();
    const limit   = Math.min(parseInt(searchParams.get('limit')  || '100'), 500);
    const offset  = parseInt(searchParams.get('offset') || '0');
    const sb = getServiceClient();

    let q = sb.from('works').select('*', { count: 'exact' });

    if (filter === 'active')    q = q.eq('status', 'published');
    else if (filter === 'submitted') q = q.in('status', SUBMITTED_STATES);
    else if (filter === 'rejected')  q = q.eq('status', 'rejected');
    else if (filter === 'deleted')   q = q.eq('status', 'deleted');
    else if (filter === 'sensitive') q = q.eq('status', 'sensitive');
    // 'all' → keine Filter außer nicht-deleted
    else q = q.neq('status', 'deleted');

    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, count, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Profile nachladen
    const userIds = [...new Set((data ?? []).map((w: { user_id: string }) => w.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await sb.from('profiles').select('id,display_name,avatar_url,email').in('id', userIds)
      : { data: [] };
    const profMap = new Map((profiles ?? []).map(p => [p.id, p]));

    // Suche anwenden
    let works = (data ?? []).map((w: Record<string, unknown>) => ({
      ...w,
      author: profMap.get(w.user_id as string) ?? null,
    }));
    if (search) {
      works = works.filter(w =>
        (w['title'] as string | undefined)?.toLowerCase().includes(search) ||
        (w.author as Record<string,unknown> | null)?.['display_name']?.toString().toLowerCase().includes(search)
      );
    }

    // Counts für alle Status
    const [allCount, submittedCount, rejectedCount, deletedCount, activeCount] = await Promise.all([
      sb.from('works').select('id', { count: 'exact', head: true }).neq('status', 'deleted'),
      sb.from('works').select('id', { count: 'exact', head: true }).in('status', SUBMITTED_STATES),
      sb.from('works').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      sb.from('works').select('id', { count: 'exact', head: true }).eq('status', 'deleted'),
      sb.from('works').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    ]);

    return NextResponse.json({
      works,
      total: count ?? 0,
      counts: {
        all:       allCount.count ?? 0,
        active:    activeCount.count ?? 0,
        submitted: submittedCount.count ?? 0,
        rejected:  rejectedCount.count ?? 0,
        deleted:   deletedCount.count ?? 0,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// PATCH: Status ändern (approve/reject/delete/restore) — nur Admin
export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { id, status, rejection_reason, admin_comment } = await req.json();
    if (!id || !status) return NextResponse.json({ ok: false, error: 'id und status erforderlich' }, { status: 400 });
    const sb = getServiceClient();

    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'published')  { updates.visibility = 'public'; updates.published_at = new Date().toISOString(); }
    if (status === 'rejected')   { updates.visibility = 'private'; if (rejection_reason) updates.rejection_reason = rejection_reason; if (admin_comment) updates.admin_comment = admin_comment; updates.rejected_at = new Date().toISOString(); }
    if (status === 'deleted')    { updates.visibility = 'private'; }

    const { error } = await sb.from('works').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Notification an User
    const { data: work } = await sb.from('works').select('user_id,title').eq('id', id).single();
    if (work?.user_id) {
      const notifMap: Record<string, { type: string; title: string; body: string }> = {
        published: { type: 'work_approved', title: '✅ Werk freigegeben', body: `„${work.title}" ist jetzt öffentlich sichtbar.` },
        rejected:  { type: 'work_rejected', title: '❌ Werk abgelehnt',  body: `„${work.title}" wurde abgelehnt.${rejection_reason ? ' Grund: ' + rejection_reason : ''}` },
      };
      const notif = notifMap[status];
      if (notif) {
        await sb.from('notifications').insert({ user_id: work.user_id, ...notif, is_read: false, read: false, data: {}, entity_id: id, entity_type: 'work' });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// DELETE: Permanent löschen — nur Admin
export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'ID fehlt' }, { status: 400 });
    const sb = getServiceClient();
    const { error } = await sb.from('works').delete().eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
