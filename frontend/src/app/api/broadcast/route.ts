// frontend/src/app/api/broadcast/route.ts
// Broadcast = Masse-Notifications via notifications Tabelle
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();
    // Broadcasts = notifications mit type='broadcast'
    const { data, count } = await sb
      .from('notifications')
      .select('id,title,body,type,created_at,user_id,is_read', { count: 'exact' })
      .eq('type', 'broadcast')
      .order('created_at', { ascending: false })
      .limit(100);

    // Unique broadcasts (nach title+created_at gruppieren für Übersicht)
    const seen = new Set<string>();
    const unique = (data ?? []).filter(n => {
      const key = `${n.title}|${n.created_at.slice(0,16)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    return NextResponse.json({ ok: true, data: unique, total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { title, body, target } = await req.json();
    if (!title || !body) return NextResponse.json({ ok: false, error: 'Titel und Inhalt erforderlich' }, { status: 400 });
    const sb = getServiceClient();

    // Empfänger bestimmen
    let userIds: string[] = [];
    if (target === 'all' || !target) {
      const { data } = await sb.from('profiles').select('id');
      userIds = (data ?? []).map(p => p.id);
    } else if (target === 'wirker') {
      const { data } = await sb.from('profiles').select('id').eq('is_wirker', true);
      userIds = (data ?? []).map(p => p.id);
    } else if (target === 'ambassador') {
      const { data } = await sb.from('profiles').select('id').eq('is_ambassador', true);
      userIds = (data ?? []).map(p => p.id);
    } else if (target === 'members') {
      const { data } = await sb.from('profiles').select('id').eq('is_member', true);
      userIds = (data ?? []).map(p => p.id);
    }

    if (userIds.length === 0) return NextResponse.json({ ok: false, error: 'Keine Empfänger gefunden' }, { status: 400 });

    // Bulk insert notifications
    const notifications = userIds.map(uid => ({
      user_id:    uid,
      type:       'broadcast',
      title,
      body,
      is_read:    false,
      read:       false,
      data:       {},
    }));

    const CHUNK = 500;
    for (let i = 0; i < notifications.length; i += CHUNK) {
      await sb.from('notifications').insert(notifications.slice(i, i + CHUNK));
    }

    return NextResponse.json({ ok: true, sent: userIds.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
