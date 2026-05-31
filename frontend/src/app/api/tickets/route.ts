// frontend/src/app/api/tickets/route.ts
// Support tickets — stored in 'invitations' table repurposed via metadata
// Fields: id, user_id, title(=subject), body, text(=category), status(in metadata)
// Actually: we store tickets as a special type in notifications with type='support_ticket'
// And replies in notification_events. Self-contained, no new table needed.

import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// We store tickets in 'invitations' table (has: id, user_id, title, body, text, created_at)
// metadata-like fields: title=subject, body=message, text=category|status|priority as JSON

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No key' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get('status');   // open|closed|all
  const ticketId = searchParams.get('id');

  if (ticketId) {
    // Single ticket
    const res = await fetch(`${SUPA}/rest/v1/invitations?id=eq.${ticketId}&select=*`, { headers: H });
    const data = await res.json().catch(() => []);
    return NextResponse.json(Array.isArray(data) ? data[0] : null);
  }

  // List — filter by our marker (tickets have title starting with "[TICKET]")
  let url = `${SUPA}/rest/v1/invitations?title=like.[TICKET]*&order=created_at.desc&limit=200&select=*`;
  const res = await fetch(url, { headers: H });
  const raw: Record<string,unknown>[] = await res.json().catch(() => []);

  // Parse metadata from 'text' field
  const tickets = raw.map(r => {
    let meta: Record<string,unknown> = {};
    try { meta = JSON.parse(r.text as string || '{}'); } catch (_) {}
    return { ...r, _status: meta.status || 'open', _priority: meta.priority || 'normal', _category: meta.category || 'general', _reply: meta.reply || null, _replied_at: meta.replied_at || null };
  });

  const filtered = status && status !== 'all'
    ? tickets.filter(t => t._status === status)
    : tickets;

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No key' }, { status: 500 });
  const { action, ticketId, userId, subject, message, category, priority, reply, adminId } = await req.json();

  if (action === 'create') {
    // Create ticket
    const meta = JSON.stringify({ status: 'open', priority: priority || 'normal', category: category || 'general', reply: null, replied_at: null });
    const res = await fetch(`${SUPA}/rest/v1/invitations`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        user_id: userId,
        title: `[TICKET] ${subject}`,
        body: message,
        text: meta,
        created_at: new Date().toISOString(),
      }),
    });
    const data = await res.json().catch(() => null);
    return res.ok ? NextResponse.json({ ok: true, data }) : NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }

  if (action === 'reply') {
    // Fetch existing
    const existing = await fetch(`${SUPA}/rest/v1/invitations?id=eq.${ticketId}&select=text`, { headers: H })
      .then(r => r.json()).catch(() => []);
    let meta: Record<string,unknown> = {};
    try { meta = JSON.parse((existing[0]?.text as string) || '{}'); } catch (_) {}
    meta.reply = reply;
    meta.replied_at = new Date().toISOString();
    meta.replied_by = adminId;
    meta.status = 'replied';

    const res = await fetch(`${SUPA}/rest/v1/invitations?id=eq.${ticketId}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ text: JSON.stringify(meta) }),
    });

    // Notify user
    if (existing[0]?.user_id) {
      await fetch(`${SUPA}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: existing[0].user_id,
          type: 'support_reply',
          title: 'Support hat geantwortet',
          body: reply,
          is_read: false,
          created_at: new Date().toISOString(),
        }),
      });
    }

    return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Reply failed' }, { status: 500 });
  }

  if (action === 'close' || action === 'reopen') {
    const existing = await fetch(`${SUPA}/rest/v1/invitations?id=eq.${ticketId}&select=text`, { headers: H })
      .then(r => r.json()).catch(() => []);
    let meta: Record<string,unknown> = {};
    try { meta = JSON.parse((existing[0]?.text as string) || '{}'); } catch (_) {}
    meta.status = action === 'close' ? 'closed' : 'open';

    const res = await fetch(`${SUPA}/rest/v1/invitations?id=eq.${ticketId}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ text: JSON.stringify(meta) }),
    });
    return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  if (action === 'delete') {
    const res = await fetch(`${SUPA}/rest/v1/invitations?id=eq.${ticketId}`, {
      method: 'DELETE',
      headers: { ...H, Prefer: 'return=minimal' },
    });
    return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
