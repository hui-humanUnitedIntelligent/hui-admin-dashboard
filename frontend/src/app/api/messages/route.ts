// frontend/src/app/api/messages/route.ts
// Nachrichten / Chats für Employee-Portal
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const chat_id = searchParams.get('chat_id');
    const limit   = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const sb = getServiceClient();

    if (chat_id) {
      // Nachrichten eines Chats
      const { data } = await sb
        .from('messages')
        .select('*')
        .eq('chat_id', chat_id)
        .order('created_at', { ascending: true })
        .limit(limit);
      return NextResponse.json({ messages: data ?? [] });
    }

    // Alle Chats (für Übersicht)
    const { data: chats, count } = await sb
      .from('chats')
      .select('id,participant_ids,state,last_message_at,last_message,created_at', { count: 'exact' })
      .order('last_message_at', { ascending: false })
      .limit(limit);

    // Profile für participant_ids laden
    const allIds = [...new Set((chats ?? []).flatMap(c => c.participant_ids ?? []))];
    const { data: profiles } = allIds.length
      ? await sb.from('profiles').select('id,display_name,avatar_url,email').in('id', allIds)
      : { data: [] };
    const profMap = new Map((profiles ?? []).map(p => [p.id, p]));

    const enriched = (chats ?? []).map(c => ({
      ...c,
      participants: (c.participant_ids ?? []).map((id: string) => profMap.get(id) ?? { id }),
    }));

    return NextResponse.json({ chats: enriched, total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { chat_id, text, sender_id, sender_name } = await req.json();
    if (!chat_id || !text) return NextResponse.json({ ok: false, error: 'chat_id und text erforderlich' }, { status: 400 });
    const sb = getServiceClient();
    const { data, error } = await sb.from('messages').insert({
      chat_id,
      text,
      sender_id:   sender_id ?? null,
      sender_name: sender_name ?? 'Admin',
      message_type:'text',
      is_read:     false,
      read:        false,
    }).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    // Chat last_message updaten
    await sb.from('chats').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', chat_id);
    return NextResponse.json({ ok: true, message: data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
