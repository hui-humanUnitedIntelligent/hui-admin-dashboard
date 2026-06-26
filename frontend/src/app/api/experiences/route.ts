// frontend/src/app/api/experiences/route.ts
// Experiences & Projekte — CRUD + Status-Aktionen
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status') || '';
    const type   = searchParams.get('type') || 'all'; // 'experiences'|'projects'|'all'
    const sb = getServiceClient();

    const results: unknown[] = [];

    if (type === 'all' || type === 'experiences') {
      let q = sb.from('experiences')
        .select('id,user_id,title,description,category,status,approval_status,sensitivity_status,rejection_reason,admin_comment,price,price_eur,cover_url,created_at,updated_at,published_at,rejected_at,visibility,event_type,location,date,start_time,end_time,max_participants')
        .order('created_at', { ascending: false }).limit(limit);
      if (status) q = q.eq('status', status);
      const { data } = await q;
      for (const e of (data ?? [])) results.push({ ...e, _source: 'experiences' });
    }

    if (type === 'all' || type === 'projects') {
      let q = sb.from('projects')
        .select('id,user_id,title,description,category,status,approval_status,sensitivity_status,rejection_reason,admin_comment,price,price_eur,cover_url,created_at,updated_at,published_at,rejected_at,visibility')
        .order('created_at', { ascending: false }).limit(limit);
      if (status) q = q.eq('status', status);
      const { data } = await q;
      for (const p of (data ?? [])) results.push({ ...p, _source: 'projects' });
    }

    results.sort((a: unknown, b: unknown) => {
      const da = (a as { created_at: string }).created_at;
      const db = (b as { created_at: string }).created_at;
      return da < db ? 1 : -1;
    });

    return NextResponse.json({ entries: results.slice(offset, offset + limit), total: results.length });
  } catch (err) {
    console.error('[experiences GET]', err);
    return NextResponse.json({ entries: [], total: 0 }, { status: 500 });
  }
}

// PATCH: Alle Aktionen — approve/reject/delete/restore/flag/clear_sensitive
export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const body = await req.json();
    const { id, _action, rejection_reason, reason, admin_comment } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'id erforderlich' }, { status: 400 });

    const sb = getServiceClient();
    const action = _action ?? '';

    // Tabelle bestimmen: id in experiences oder projects suchen
    let table = 'experiences';
    const { data: expRow } = await sb.from('experiences').select('id').eq('id', id).single();
    if (!expRow) {
      const { data: projRow } = await sb.from('projects').select('id').eq('id', id).single();
      if (projRow) table = 'projects';
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };

    if (action === 'approve_experience' || action === 'approve_project' || action === 'approve') {
      updates.status          = 'published';
      updates.approval_status = 'approved';
      updates.visibility      = 'public';
      updates.published_at    = now;
      updates.rejection_reason = null;
    } else if (action === 'reject_experience' || action === 'reject_project' || action === 'reject') {
      const rej = rejection_reason ?? reason ?? body.data?.reason ?? 'Abgelehnt';
      updates.status           = 'rejected';
      updates.approval_status  = 'rejected';
      updates.visibility       = 'private';
      updates.rejection_reason = rej;
      updates.rejected_at      = now;
      if (admin_comment) updates.admin_comment = admin_comment;
    } else if (action === 'delete_experience' || action === 'delete_project' || action === 'soft_delete_experience' || action === 'soft_delete_project') {
      updates.status     = 'deleted';
      updates.visibility = 'private';
    } else if (action === 'restore_experience' || action === 'restore_project') {
      updates.status          = 'published';
      updates.approval_status = 'approved';
      updates.visibility      = 'public';
    } else if (action === 'flag_experience' || action === 'flag_project' || action === 'mark_sensitive_experience' || action === 'mark_sensitive_project') {
      updates.sensitivity_status = 'flagged';
      updates.visibility         = 'private';
      if (reason) updates.sensitivity_reason = reason;
    } else if (action === 'clear_sensitive_experience' || action === 'clear_sensitive_project' || action === 'unflag_experience' || action === 'unflag_project') {
      updates.sensitivity_status = 'cleared';
      if (table === 'experiences' || table === 'projects') updates.visibility = 'public';
    } else if (action === 'set_comment_experience' || action === 'set_comment_project' || action === 'update_work') {
      if (admin_comment !== undefined) updates.admin_comment = admin_comment;
    } else {
      return NextResponse.json({ ok: false, error: `Unbekannte Aktion: ${action}` }, { status: 400 });
    }

    const { error } = await sb.from(table).update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Notification an Nutzer senden
    try {
      const { data: entry } = await sb.from(table).select('user_id,title').eq('id', id).single();
      if (entry?.user_id) {
        const notifMap: Record<string, { type: string; title: string; body: string }> = {
          approve_experience: { type: 'content_approved', title: '\u2705 Erlebnis freigegeben',    body: `\u201e${entry.title}\u201c ist jetzt live und sichtbar.` },
          approve_project:    { type: 'content_approved', title: '\u2705 Projekt freigegeben',     body: `\u201e${entry.title}\u201c ist jetzt live und sichtbar.` },
          approve:            { type: 'content_approved', title: '\u2705 Inhalt freigegeben',      body: `\u201e${entry.title}\u201c ist jetzt live und sichtbar.` },
          reject_experience:  { type: 'content_rejected', title: '\u274c Erlebnis abgelehnt',      body: `\u201e${entry.title}\u201c wurde leider abgelehnt.` },
          reject_project:     { type: 'content_rejected', title: '\u274c Projekt abgelehnt',       body: `\u201e${entry.title}\u201c wurde leider abgelehnt.` },
          delete_experience:  { type: 'content_deleted',  title: '\uD83D\uDDD1 Erlebnis gel\u00f6scht',  body: `\u201e${entry.title}\u201c wurde gel\u00f6scht.` },
          delete_project:     { type: 'content_deleted',  title: '\uD83D\uDDD1 Projekt gel\u00f6scht',   body: `\u201e${entry.title}\u201c wurde gel\u00f6scht.` },
        };
        const notif = notifMap[action];
        if (notif) {
          await sb.from('notifications').insert({
            user_id: entry.user_id, type: notif.type, title: notif.title,
            body: notif.body, is_read: false, read: false,
            data: {}, entity_id: id, entity_type: table,
          });
        }
      }
    } catch { /* Notification-Fehler nicht blocken */ }

    return NextResponse.json({ ok: true, action, id, table });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[experiences PATCH]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
