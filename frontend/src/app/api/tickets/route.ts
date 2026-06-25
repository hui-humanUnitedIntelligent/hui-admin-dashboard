// frontend/src/app/api/tickets/route.ts
// Support tickets — gespeichert in 'invitations' table
// Marker: title startet mit "[TICKET]"
// Metadata (status, priority, category, reply) in 'text'-Feld als JSON

import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

type TicketMeta = {
  status?:     string;
  priority?:   string;
  category?:   string;
  reply?:      string;
  repliedAt?:  string;
  adminId?:    string;
};

function parseMeta(text: string | null): TicketMeta {
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const sb     = getServiceClient();
    const params = new URL(req.url).searchParams;
    const status   = params.get('status');
    const ticketId = params.get('id');

    if (ticketId) {
      const { data, error } = await sb
        .from('invitations').select('*').eq('id', ticketId).limit(1).single();
      if (error) throw error;
      if (!data) return (await import('@/app/lib/api-response')).notFound('Ticket');
      const meta = parseMeta(data.text as string);
      return ok({ ...data, _status: meta.status ?? 'open', _priority: meta.priority ?? 'normal', _category: meta.category ?? 'general', _reply: meta.reply ?? null });
    }

    const { data, error } = await sb
      .from('invitations')
      .select('*')
      .like('title', '[TICKET]%')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const tickets = (data ?? []).map(r => {
      const meta = parseMeta(r.text as string);
      return { ...r, _status: meta.status ?? 'open', _priority: meta.priority ?? 'normal', _category: meta.category ?? 'general', _reply: meta.reply ?? null, _repliedAt: meta.repliedAt ?? null };
    });

    const filtered = (status && status !== 'all')
      ? tickets.filter(t => t._status === status)
      : tickets;

    return ok(filtered);
  } catch (err) {
    return serverError(err, 'tickets GET');
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, ticketId, userId, subject, message, category, priority, reply, adminId } = body as {
      action?: string; ticketId?: string; userId?: string; subject?: string;
      message?: string; category?: string; priority?: string; reply?: string; adminId?: string;
    };
    if (!action) return validationError({ action: 'Pflichtfeld' });

    const sb  = getServiceClient();
    const now = new Date().toISOString();

    if (action === 'create') {
      if (!subject?.trim() || !message?.trim()) {
        return validationError({ subject: 'Pflichtfeld', message: 'Pflichtfeld' });
      }
      const meta: TicketMeta = { status: 'open', priority: priority ?? 'normal', category: category ?? 'general' };
      const { data, error } = await sb.from('invitations').insert({
        user_id:    userId ?? null,
        title:      `[TICKET] ${subject.trim()}`,
        body:       message.trim(),
        text:       JSON.stringify(meta),
        created_at: now,
      }).select().single();
      if (error) throw error;
      return (await import('@/app/lib/api-response')).created(data);
    }

    if (!ticketId) return validationError({ ticketId: 'Pflichtfeld' });

    const { data: existing, error: fetchErr } = await sb
      .from('invitations').select('*').eq('id', ticketId).limit(1).single();
    if (fetchErr || !existing) return (await import('@/app/lib/api-response')).notFound('Ticket');

    const meta = parseMeta(existing.text as string);

    if (action === 'reply') {
      if (!reply?.trim()) return validationError({ reply: 'Pflichtfeld' });
      meta.reply     = reply.trim();
      meta.repliedAt = now;
      meta.status    = 'replied';
      meta.adminId   = adminId;

      const { error } = await sb.from('invitations').update({ text: JSON.stringify(meta) }).eq('id', ticketId);
      if (error) throw error;

      // Nutzer benachrichtigen
      if (existing.user_id) {
        try {
        await sb.from('notifications').insert({
          user_id: existing.user_id, type: 'support_reply',
          title: 'Support hat geantwortet', message: reply.trim(),
          is_read: false, read: false, created_at: now,
        });
        } catch (_) {}
      }
      return ok({ replied: true });
    }

    if (action === 'close' || action === 'reopen') {
      meta.status = action === 'close' ? 'closed' : 'open';
      const { error } = await sb.from('invitations').update({ text: JSON.stringify(meta) }).eq('id', ticketId);
      if (error) throw error;
      return ok({ status: meta.status });
    }

    if (action === 'delete') {
      const { error } = await sb.from('invitations').delete().eq('id', ticketId);
      if (error) throw error;
      return ok({ deleted: true, ticketId });
    }

    return fail(`Unbekannte Aktion: ${action}`);
  } catch (err) {
    return serverError(err, 'tickets POST');
  }
}
