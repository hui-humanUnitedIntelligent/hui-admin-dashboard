// frontend/src/app/api/experiences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const EXP_SELECT = 'id,user_id,title,description,price,cover_url,status,approval_status,sensitivity_status,sensitivity_reason,rejection_reason,admin_comment,review_note,reviewed_at,rejected_at,created_at,updated_at,visibility,category,location_text,date,time_start,time_end,max_participants,experience_type,format,profiles!user_id(full_name,username)';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status') || '';
    const sb = getServiceClient();

    let q = sb.from('experiences')
      .select(EXP_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false });
    if (status) q = q.eq('approval_status', status);
    const { data, count } = await q.range(offset, offset + limit - 1);

    const entries = (data ?? []).map((e: Record<string,unknown>) => ({ ...e, _source: 'experiences' }));
    return NextResponse.json({ entries, total: count ?? 0 });
  } catch (err) {
    console.error('[experiences GET]', err);
    return NextResponse.json({ entries: [], total: 0 }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { id, _action, rejection_reason, reason, admin_comment } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'id erforderlich' }, { status: 400 });

    const action = _action ?? '';
    const sb = getServiceClient();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };

    if (action === 'approve_experience' || action === 'approve') {
      updates.status          = 'published';
      updates.approval_status = 'approved';
      updates.visibility      = 'public';
      updates.rejection_reason = null;
      updates.reviewed_at     = now;
    } else if (action === 'reject_experience' || action === 'reject') {
      const rej = rejection_reason ?? reason ?? body.data?.reason ?? 'Nicht genehmigt';
      updates.status           = 'rejected';
      updates.approval_status  = 'rejected';
      updates.visibility       = 'private';
      updates.rejection_reason = rej;
      updates.rejected_at      = now;
      updates.reviewed_at      = now;
      if (admin_comment) updates.admin_comment = admin_comment;
    } else if (action === 'delete_experience' || action === 'soft_delete_experience') {
      updates.status     = 'deleted';
      updates.visibility = 'private';
    } else if (action === 'restore_experience') {
      updates.status          = 'published';
      updates.approval_status = 'approved';
      updates.visibility      = 'public';
    } else if (action === 'flag_experience' || action === 'mark_sensitive_experience') {
      updates.sensitivity_status = 'flagged';
      updates.visibility         = 'private';
      if (reason) updates.sensitivity_reason = reason;
    } else if (action === 'clear_sensitive_experience' || action === 'unflag_experience') {
      updates.sensitivity_status = 'cleared';
      updates.sensitivity_reason = null;
    } else if (action === 'set_comment_experience') {
      if (admin_comment !== undefined) updates.admin_comment = admin_comment;
    } else if (action === 'restore_experience') {
      updates.status          = 'published';
      updates.approval_status = 'approved';
      updates.visibility      = 'public';
    } else if (action === 'hard_delete_experience') {
      // Permanentes Löschen aus DB
      const { error: delErr } = await sb.from('experiences').delete().eq('id', id);
      if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, action, id, deleted: true });
    } else {
      return NextResponse.json({ ok: false, error: `Unbekannte Aktion: ${action}` }, { status: 400 });
    }

    const { error } = await sb.from('experiences').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Notification an Nutzer
    try {
      const { data: entry } = await sb.from('experiences').select('user_id,title').eq('id', id).single();
      if (entry?.user_id) {
        const notifMap: Record<string, { type: string; title: string; body: string }> = {
          approve_experience: { type: 'content_approved', title: '\u2705 Erlebnis freigegeben', body: `\u201e${entry.title}\u201c ist jetzt live!` },
          approve:            { type: 'content_approved', title: '\u2705 Erlebnis freigegeben', body: `\u201e${entry.title}\u201c ist jetzt live!` },
          reject_experience:  { type: 'content_rejected', title: '\u274c Erlebnis abgelehnt',  body: `\u201e${entry.title}\u201c wurde abgelehnt.` },
          reject:             { type: 'content_rejected', title: '\u274c Erlebnis abgelehnt',  body: `\u201e${entry.title}\u201c wurde abgelehnt.` },
          delete_experience:  { type: 'content_deleted',  title: '\uD83D\uDDD1 Erlebnis gel\u00f6scht', body: `\u201e${entry.title}\u201c wurde gel\u00f6scht.` },
        };
        const notif = notifMap[action];
        if (notif) {
          await sb.from('notifications').insert({
            user_id: entry.user_id, type: notif.type, title: notif.title,
            body: notif.body, is_read: false, read: false,
            data: {}, entity_id: id, entity_type: 'experience',
          });
        }
      }
    } catch { /* Notification nicht blocken */ }

    return NextResponse.json({ ok: true, action, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[experiences PATCH]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
