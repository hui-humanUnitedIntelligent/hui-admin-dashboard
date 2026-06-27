// frontend/src/app/api/tickets/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

interface Attachment { name:string; url:string; type:string; size:number }

function parseTicket(row: Record<string, unknown>) {
  const rawData = row.data;
  const raw: Record<string, unknown> = (rawData && typeof rawData === 'object' && !Array.isArray(rawData))
    ? (rawData as Record<string, unknown>) : {};
  return {
    id:            row.id as string,
    created_at:    row.created_at as string,
    user_id:       row.user_id as string|null,
    ticket_number: String(raw.ticket_number ?? 'HUI-????'),
    name:          String(raw.name  ?? ''),
    email:         String(raw.email ?? ''),
    phone:         String(raw.phone ?? ''),
    category:      String(raw.category ?? 'sonstiges'),
    priority:      String(raw.priority  ?? 'normal'),
    subject:       String(raw.subject   ?? '').replace(/^RE:\s*/i, '').replace(/^\[HUI-[^\]]+\]\s*/, ''),
    full_subject:  String(raw.subject   ?? ''),
    message:       String(raw.message   ?? ''),
    status:        String(raw.status    ?? 'open') as 'open'|'replied'|'closed',
    attachments:   Array.isArray(raw.attachments) ? raw.attachments as Attachment[] : [],
    admin_reply:   raw.admin_reply  != null ? String(raw.admin_reply)  : null,
    replied_at:    raw.replied_at   != null ? String(raw.replied_at)   : null,
    read_by_admin: Boolean(raw.read_by_admin ?? false),
    is_followup:   Boolean(raw.is_followup  ?? false),
  };
}

// Tickets nach Ticket-Nummer gruppieren → ein Thread pro Nummer
function groupIntoThreads(rows: ReturnType<typeof parseTicket>[]) {
  const map: Record<string, ReturnType<typeof parseTicket>[]> = {};
  rows.forEach(t => {
    const nr = t.ticket_number;
    if (!map[nr]) map[nr] = [];
    map[nr].push(t);
  });

  return Object.entries(map).map(([ticketNumber, msgs]) => {
    const sorted   = msgs.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const original = sorted.find(m => !m.is_followup) ?? sorted[0];
    const latest   = sorted[sorted.length - 1];
    const unread   = msgs.some(m => !m.read_by_admin);

    // Thread-Status: wenn neueste Nachricht von User (kein admin_reply) → open
    // wenn admin hat geantwortet auf neueste → replied
    const latestUserMsg = [...sorted].reverse().find(m => true); // letztes Element
    let threadStatus: 'open'|'replied'|'closed' = 'open';
    if (latest.status === 'closed') threadStatus = 'closed';
    else if (latest.is_followup && !latest.admin_reply) threadStatus = 'open';   // User hat geantwortet → offen
    else if (latest.admin_reply) threadStatus = 'replied';
    else if (latest.status === 'replied') threadStatus = 'replied';

    return {
      ticket_number:  ticketNumber,
      subject:        original.subject || original.full_subject,
      name:           original.name,
      email:          original.email,
      phone:          original.phone,
      category:       original.category,
      priority:       original.priority,
      user_id:        original.user_id,
      created_at:     original.created_at,
      updated_at:     latest.created_at,
      status:         threadStatus,
      unread,
      message_count:  msgs.length,
      messages:       sorted,   // alle Nachrichten im Thread
      // Letztes Msg-Preview
      preview:        latest.message.slice(0, 80),
    };
  }).sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const tnr    = searchParams.get('ticket_number'); // einzelner Thread
  const search = searchParams.get('search') ?? '';
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '500'), 1000);

  try {
    const sb = getServiceClient();

    const { data, error } = await sb.from('notifications')
      .select('*')
      .eq('type', 'support_ticket')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) return serverError(error, 'tickets GET');

    const all     = (data ?? []).map(r => parseTicket(r as Record<string, unknown>));
    let threads   = groupIntoThreads(all);

    // Als gelesen markieren wenn einzelner Thread abgerufen
    if (tnr) {
      const thread = threads.find(t => t.ticket_number === tnr);
      if (!thread) return fail('Thread nicht gefunden');
      // Alle Nachrichten dieses Threads als gelesen markieren
      const ids = thread.messages.filter(m => !m.read_by_admin).map(m => m.id);
      if (ids.length > 0) {
        for (const id of ids) {
          const row = data?.find(r => r.id === id);
          if (row) {
            await sb.from('notifications').update({
              data: { ...(row.data as object ?? {}), read_by_admin: true }
            }).eq('id', id);
          }
        }
      }
      return ok(thread);
    }

    // Filter
    if (status && status !== 'all') threads = threads.filter(t => t.status === status);
    if (search) {
      const s = search.toLowerCase();
      threads = threads.filter(t =>
        t.ticket_number.toLowerCase().includes(s) ||
        t.name.toLowerCase().includes(s) ||
        t.email.toLowerCase().includes(s) ||
        t.subject.toLowerCase().includes(s)
      );
    }

    const stats = {
      open:    threads.filter(t => t.status === 'open').length,
      replied: threads.filter(t => t.status === 'replied').length,
      closed:  threads.filter(t => t.status === 'closed').length,
      total:   threads.length,
      unread:  threads.filter(t => t.unread).length,
    };

    return ok({ threads, stats });
  } catch (err) {
    return serverError(err, 'tickets GET');
  }
}

// ── PATCH — Admin antwortet auf Thread (setzt status=replied auf letzter User-Msg) ──
export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json() as {
      ticket_number?: string;
      id?: string;
      action?: string;
      status?: string;
      reply?: string;
      priority?: string;
    };

    const sb = getServiceClient();

    // Antwort auf Thread: finde letzte unbeantworte User-Nachricht
    if (body.ticket_number && body.action === 'reply' && body.reply) {
      const { data: rows } = await sb.from('notifications')
        .select('*')
        .eq('type', 'support_ticket')
        .order('created_at', { ascending: false })
        .limit(100);

      const threadRows = (rows ?? []).filter(r => {
        const d = r.data as Record<string, unknown>;
        return String(d?.ticket_number ?? '') === body.ticket_number;
      });

      // Letzte Nachricht finden
      if (threadRows.length === 0) return fail('Thread nicht gefunden');
      const latest = threadRows[0]; // DESC sort → neueste zuerst
      const currentData = (latest.data as Record<string, unknown>) ?? {};

      const updateData = {
        ...currentData,
        admin_reply:   body.reply,
        replied_at:    new Date().toISOString(),
        status:        'replied',
        read_by_admin: true,
      };

      const { error } = await sb.from('notifications')
        .update({ data: updateData }).eq('id', latest.id);
      if (error) return serverError(error, 'tickets PATCH reply');

      // Resonanzzentrum Notification
      if (latest.user_id) {
        await sb.from('notifications').insert({
          user_id:     latest.user_id,
          type:        'support_ticket_reply',
          title:       `Dein Ticket ${body.ticket_number} wurde beantwortet`,
          body:        body.reply.slice(0, 200),
          data: {
            ticket_number:    body.ticket_number,
            subject:          String(currentData.subject ?? ''),
            reply:            body.reply,
            original_message: String(currentData.message ?? ''),
            notification_id:  latest.id,
          },
          is_read:    false,
          action_url: '/studio?section=tickets',
          entity_type:'support_ticket',
          entity_id:  latest.id as string,
        }).catch(() => {});
      }

      return ok({ ticket_number: body.ticket_number, status: 'replied' });
    }

    // Einzelne Nachricht aktualisieren (close/reopen/read)
    if (body.id) {
      const { data: existing } = await sb.from('notifications').select('*').eq('id', body.id).single();
      if (!existing) return fail('Nicht gefunden');
      const d = { ...(existing.data as object ?? {}) } as Record<string, unknown>;

      if (body.action === 'close')  d.status = 'closed';
      if (body.action === 'reopen') d.status = 'open';
      if (body.action === 'read')   d.read_by_admin = true;
      if (body.status)   d.status   = body.status;
      if (body.priority) d.priority = body.priority;

      const { error } = await sb.from('notifications').update({ data: d }).eq('id', body.id);
      if (error) return serverError(error, 'tickets PATCH id');
      return ok({ id: body.id });
    }

    // Thread schließen/öffnen
    if (body.ticket_number && (body.action === 'close' || body.action === 'reopen')) {
      const newStatus = body.action === 'close' ? 'closed' : 'open';
      const { data: rows } = await sb.from('notifications')
        .select('*').eq('type', 'support_ticket').limit(500);
      const threadRows = (rows ?? []).filter(r => {
        const d = r.data as Record<string, unknown>;
        return String(d?.ticket_number ?? '') === body.ticket_number;
      });
      for (const row of threadRows) {
        await sb.from('notifications').update({
          data: { ...(row.data as object ?? {}), status: newStatus }
        }).eq('id', row.id);
      }
      return ok({ ticket_number: body.ticket_number, status: newStatus });
    }

    return fail('Ungültige Aktion');
  } catch (err) {
    return serverError(err, 'tickets PATCH');
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { id, ticket_number } = await req.json() as { id?:string; ticket_number?:string };
    const sb = getServiceClient();
    if (ticket_number) {
      // Ganzen Thread löschen
      const { data: rows } = await sb.from('notifications').select('id').eq('type','support_ticket').limit(500);
      // Wir müssen data.ticket_number filtern — kein DB-Filter auf JSON
      // Alternativ: alle laden und filtern
      const { data: allRows } = await sb.from('notifications').select('*').eq('type','support_ticket').limit(500);
      const ids = (allRows ?? [])
        .filter(r => String((r.data as Record<string,unknown>)?.ticket_number ?? '') === ticket_number)
        .map(r => r.id);
      if (ids.length > 0) {
        await sb.from('notifications').delete().in('id', ids);
      }
      return ok({ deleted_count: ids.length });
    }
    if (id) {
      await sb.from('notifications').delete().eq('id', id).eq('type', 'support_ticket');
      return ok({ deleted: id });
    }
    return fail('id oder ticket_number erforderlich');
  } catch (err) {
    return serverError(err, 'tickets DELETE');
  }
}
