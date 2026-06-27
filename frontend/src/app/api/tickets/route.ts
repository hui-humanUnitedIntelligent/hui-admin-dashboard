// frontend/src/app/api/tickets/route.ts
// Support-Tickets gespeichert in notifications (type='support_ticket')
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

function parseTicket(row: Record<string, unknown>) {
  const raw  = row.data as Record<string, unknown> ?? {};
  return {
    id:            row.id,
    created_at:    row.created_at,
    ticket_number: raw.ticket_number ?? 'HUI-????',
    name:          raw.name          ?? '',
    email:         raw.email         ?? '',
    phone:         raw.phone         ?? '',
    category:      raw.category      ?? 'sonstiges',
    priority:      raw.priority      ?? 'normal',
    subject:       raw.subject       ?? (row.title as string ?? '').replace(/^\[HUI-[^\]]+\]\s*/, ''),
    message:       raw.message       ?? (row.body as string ?? ''),
    status:        raw.status        ?? 'open',
    attachments:   raw.attachments   ?? [],
    admin_reply:   raw.admin_reply   ?? null,
    replied_at:    raw.replied_at    ?? null,
    read_by_admin: raw.read_by_admin ?? false,
    user_id:       row.user_id,
  };
}

// ── GET /api/tickets ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const status  = searchParams.get('status');
  const id      = searchParams.get('id');
  const search  = searchParams.get('search') ?? '';
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);

  try {
    const sb = getServiceClient();

    // Einzelticket
    if (id) {
      const { data, error } = await sb.from('notifications')
        .select('*').eq('id', id).eq('type', 'support_ticket').single();
      if (error || !data) return fail('Ticket nicht gefunden');
      // Als gelesen markieren
      await sb.from('notifications').update({
        data: { ...(data.data as object ?? {}), read_by_admin: true }
      }).eq('id', id);
      return ok(parseTicket(data as Record<string, unknown>));
    }

    // Liste
    let q = sb.from('notifications')
      .select('*', { count: 'exact' })
      .eq('type', 'support_ticket')
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error, count } = await q;
    if (error) return serverError(error, 'tickets GET');

    let tickets = (data ?? []).map(r => parseTicket(r as Record<string, unknown>));

    // Status-Filter client-seitig (da status im JSON-data liegt)
    if (status && status !== 'all') {
      tickets = tickets.filter(t => t.status === status);
    }
    if (search) {
      const s = search.toLowerCase();
      tickets = tickets.filter(t =>
        t.ticket_number.toLowerCase().includes(s) ||
        t.name.toLowerCase().includes(s) ||
        t.email.toLowerCase().includes(s) ||
        t.subject.toLowerCase().includes(s)
      );
    }

    const stats = {
      open:     tickets.filter(t => t.status === 'open').length,
      replied:  tickets.filter(t => t.status === 'replied').length,
      closed:   tickets.filter(t => t.status === 'closed').length,
      total:    tickets.length,
      unread:   tickets.filter(t => !t.read_by_admin).length,
    };

    return ok({ tickets, stats, total: count ?? 0 });
  } catch (err) {
    return serverError(err, 'tickets GET');
  }
}

// ── PATCH /api/tickets — Status ändern, Reply, Als gelesen markieren ─────────
export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json() as {
      id?: string;
      action?: string;
      status?: string;
      reply?: string;
      priority?: string;
    };
    if (!body.id) return fail('id erforderlich');

    const sb = getServiceClient();
    const { data: existing, error: fetchErr } = await sb
      .from('notifications').select('*').eq('id', body.id).single();
    if (fetchErr || !existing) return fail('Ticket nicht gefunden');

    const currentData = (existing.data as Record<string, unknown>) ?? {};
    const update: Record<string, unknown> = { ...currentData };

    if (body.action === 'reply' && body.reply) {
      update.admin_reply  = body.reply;
      update.replied_at   = new Date().toISOString();
      update.status       = 'replied';
      update.read_by_admin = true;
    }
    if (body.action === 'close') {
      update.status = 'closed';
    }
    if (body.action === 'reopen') {
      update.status = 'open';
    }
    if (body.action === 'read') {
      update.read_by_admin = true;
    }
    if (body.status) {
      update.status = body.status;
    }
    if (body.priority) {
      update.priority = body.priority;
    }

    const { error } = await sb.from('notifications')
      .update({ data: update }).eq('id', body.id);
    if (error) return serverError(error, 'tickets PATCH');

    return ok({ id: body.id, updated: update });
  } catch (err) {
    return serverError(err, 'tickets PATCH');
  }
}

// ── DELETE /api/tickets ────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { id } = await req.json() as { id?: string };
    if (!id) return fail('id erforderlich');

    const sb = getServiceClient();
    const { error } = await sb.from('notifications').delete().eq('id', id).eq('type', 'support_ticket');
    if (error) return serverError(error, 'tickets DELETE');

    return ok({ deleted: id });
  } catch (err) {
    return serverError(err, 'tickets DELETE');
  }
}
