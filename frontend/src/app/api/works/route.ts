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
      works = works.filter(w => {
        const title   = String((w as Record<string,unknown>)['title']   ?? '').toLowerCase();
        const dname   = String(((w as Record<string,unknown>)['author'] as Record<string,unknown> | null)?.['display_name'] ?? '').toLowerCase();
        return title.includes(search) || dname.includes(search);
      });
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

// PATCH: Status ändern (approve/reject/delete/restore/flag/unflag) — Employee+Admin

// PATCH: Alle Button-Aktionen — approve/reject/flag/unflag/delete/restore/clear_sensitive
export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { id, _action, status: directStatus, rejection_reason, admin_comment, reason } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'id erforderlich' }, { status: 400 });

    const sb = getServiceClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const action = _action ?? '';

    if (action === 'approve_work' || action === 'publish_work') {
      updates.status          = 'published';
      updates.approval_status = 'approved';
      updates.visibility      = 'public';
      updates.published_at    = new Date().toISOString();

    } else if (action === 'reject_work') {
      const rej = rejection_reason ?? reason ?? body.data?.reason ?? 'Nicht genehmigt';
      updates.status           = 'rejected';
      updates.approval_status  = 'rejected';
      updates.visibility       = 'private';
      updates.rejection_reason = rej;
      updates.rejected_at      = new Date().toISOString();
      if (admin_comment) updates.admin_comment = admin_comment;

    } else if (action === 'flag_work') {
      updates.status             = 'flagged';
      updates.sensitivity_status = 'flagged';
      updates.visibility         = 'private';
      if (reason ?? body.data?.reason) updates.sensitivity_reason = reason ?? body.data?.reason;

    } else if (action === 'unflag_work') {
      updates.status             = 'published';
      updates.sensitivity_status = 'cleared';
      updates.sensitivity_reason = null;
      updates.visibility         = 'public';

    } else if (action === 'delete_work' || action === 'soft_delete_work') {
      updates.status     = 'deleted';
      updates.visibility = 'private';

    } else if (action === 'restore_work') {
      updates.status          = 'published';
      updates.approval_status = 'approved';
      updates.visibility      = 'public';

    } else if (action === 'unpublish_work') {
      updates.status     = 'draft';
      updates.visibility = 'private';

    } else if (action === 'clear_sensitive_work') {
      updates.sensitivity_status = 'cleared';
      updates.sensitivity_reason = null;

    } else if (action === 'mark_sensitive_work') {
      updates.sensitivity_status = 'flagged';
      if (reason ?? body.data?.reason) updates.sensitivity_reason = reason ?? body.data?.reason;

    } else if (action === 'update_work') {
      const allowed = ['title','description','price','price_eur','admin_comment','review_note'];
      for (const k of allowed) { if (body[k] !== undefined) updates[k] = body[k]; }

    } else if (directStatus) {
      // Direkter Status-Patch (kein _action)
      updates.status = directStatus;
      if (directStatus === 'published') { updates.visibility = 'public'; updates.published_at = new Date().toISOString(); updates.approval_status = 'approved'; }
      if (directStatus === 'rejected')  { updates.visibility = 'private'; if (rejection_reason) updates.rejection_reason = rejection_reason; if (rejection_reason) updates.rejected_at = new Date().toISOString(); }
      if (directStatus === 'deleted')   updates.visibility = 'private';
      if (directStatus === 'flagged')   { updates.visibility = 'private'; updates.sensitivity_status = 'flagged'; }

    } else {
      return NextResponse.json({ ok: false, error: '_action oder status erforderlich' }, { status: 400 });
    }

    const { error } = await sb.from('works').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Notification an Nutzer
    try {
      const { data: work } = await sb.from('works').select('user_id,title').eq('id', id).single();
      if (work?.user_id) {
        const notifMap: Record<string, { type: string; title: string; body: string } | null> = {
          approve_work:       { type: 'work_approved', title: '\u2705 Werk freigegeben',      body: `\u201e${work.title}\u201c ist jetzt live.` },
          publish_work:       { type: 'work_approved', title: '\u2705 Werk freigegeben',      body: `\u201e${work.title}\u201c ist jetzt live.` },
          reject_work:        { type: 'work_rejected', title: '\u274c Werk abgelehnt',        body: `\u201e${work.title}\u201c wurde abgelehnt.` },
          flag_work:          { type: 'work_flagged',  title: '\u26a0\ufe0f Inhalt gemeldet', body: `\u201e${work.title}\u201c wurde gemeldet.` },
          delete_work:        { type: 'work_deleted',  title: '\uD83D\uDDD1 Werk gel\u00f6scht', body: `\u201e${work.title}\u201c wurde gel\u00f6scht.` },
          soft_delete_work:   { type: 'work_deleted',  title: '\uD83D\uDDD1 Werk gel\u00f6scht', body: `\u201e${work.title}\u201c wurde gel\u00f6scht.` },
          restore_work:       { type: 'work_approved', title: '\u2705 Werk wiederhergestellt', body: `\u201e${work.title}\u201c ist wieder sichtbar.` },
          unflag_work:        { type: 'work_approved', title: '\u2705 Meldung aufgehoben',    body: `\u201e${work.title}\u201c ist wieder sichtbar.` },
        };
        const notif = notifMap[action];
        if (notif) {
          await sb.from('notifications').insert({
            user_id: work.user_id, type: notif.type, title: notif.title,
            body: notif.body, is_read: false, read: false, data: {},
            entity_id: id, entity_type: 'work',
          });
        }
      }
    } catch { /* Notification-Fehler nicht blocken */ }

    return NextResponse.json({ ok: true, action, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[works PATCH]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE: Permanent löschen — nur Admin
export async function DELETE(req: NextRequest) {
  const guard = await guardEmployee(req);
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
