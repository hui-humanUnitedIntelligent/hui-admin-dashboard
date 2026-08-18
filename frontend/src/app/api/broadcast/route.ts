// frontend/src/app/api/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee, guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();
    const action = req.nextUrl.searchParams.get('action');

    if (action === 'stats') {
      const [total, wirker, members, admins] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'like', '%hui-commerce.test%'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'like', '%hui-commerce.test%').eq('is_wirker', true),
        sb.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'like', '%hui-commerce.test%').eq('is_member', true),
        sb.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'like', '%hui-commerce.test%').in('role', ['admin', 'superadmin']),
      ]);
      const { data: bData } = await sb.from('notifications').select('title,created_at').eq('type', 'broadcast');
      const seen = new Set<string>();
      for (const n of (bData ?? [])) {
        seen.add(`${n.title}|${n.created_at?.slice(0, 16)}`);
      }
      return NextResponse.json({
        total_users:      total.count ?? 0,
        wirker:           wirker.count ?? 0,
        members:          members.count ?? 0,
        admins:           admins.count ?? 0,
        total_broadcasts: seen.size,
      });
    }

    // list — Verlauf
    const { data } = await sb
      .from('notifications')
      .select('id,title,body,type,created_at,user_id')
      .eq('type', 'broadcast')
      .order('created_at', { ascending: false })
      .limit(500);

    const map = new Map<string, { id: string; title: string; body: string; target_group: string; sent_count: number; created_at: string; }>();
    for (const n of (data ?? [])) {
      const key = `${n.title}|${n.created_at?.slice(0, 16)}`;
      if (!map.has(key)) {
        map.set(key, { id: n.id, title: n.title, body: n.body ?? '', target_group: 'all', sent_count: 1, created_at: n.created_at });
      } else {
        map.get(key)!.sent_count++;
      }
    }
    return NextResponse.json(Array.from(map.values()));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { title, body, target_group } = await req.json();
    if (!title || !body) return NextResponse.json({ ok: false, error: 'Titel und Inhalt erforderlich' }, { status: 400 });
    const sb = getServiceClient();

    let userIds: string[] = [];
    if (target_group === 'wirker') {
      const { data } = await sb.from('profiles').select('id').not('email', 'like', '%hui-commerce.test%').eq('is_wirker', true);
      userIds = (data ?? []).map((p: { id: string }) => p.id);
    } else if (target_group === 'members') {
      const { data } = await sb.from('profiles').select('id').not('email', 'like', '%hui-commerce.test%').eq('is_member', true);
      userIds = (data ?? []).map((p: { id: string }) => p.id);
    } else if (target_group === 'admins') {
      const { data } = await sb.from('profiles').select('id').not('email', 'like', '%hui-commerce.test%').in('role', ['admin', 'superadmin']);
      userIds = (data ?? []).map((p: { id: string }) => p.id);
    } else if (target_group === 'basisuser') {
      const { data } = await sb.from('profiles').select('id,is_wirker,is_member,role').not('email', 'like', '%hui-commerce.test%');
      userIds = (data ?? []).filter((p: { is_wirker: boolean; is_member: boolean; role: string }) => !p.is_wirker && !p.is_member && p.role !== 'admin' && p.role !== 'superadmin').map((p: { id: string }) => p.id);
    } else {
      const { data } = await sb.from('profiles').select('id').not('email', 'like', '%hui-commerce.test%');
      userIds = (data ?? []).map((p: { id: string }) => p.id);
    }

    if (userIds.length === 0) return NextResponse.json({ ok: false, error: 'Keine Empfänger gefunden' }, { status: 400 });

    const notifications = userIds.map(uid => ({ user_id: uid, type: 'broadcast', title, body, is_read: false, read: false, data: {} }));
    const CHUNK = 500;
    for (let i = 0; i < notifications.length; i += CHUNK) {
      await sb.from('notifications').insert(notifications.slice(i, i + CHUNK));
    }
    return NextResponse.json({ ok: true, sent_count: userIds.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();
    const broadcast_id = req.nextUrl.searchParams.get('broadcast_id');
    if (!broadcast_id) return NextResponse.json({ error: 'broadcast_id fehlt' }, { status: 400 });
    const { data: ref } = await sb.from('notifications').select('title,created_at').eq('id', broadcast_id).single();
    if (!ref) return NextResponse.json({ error: 'Broadcast nicht gefunden' }, { status: 404 });
    const minTime = ref.created_at.slice(0, 16);
    const maxTime = new Date(new Date(ref.created_at).getTime() + 60000).toISOString();
    const { count } = await sb.from('notifications').delete({ count: 'exact' })
      .eq('type', 'broadcast').eq('title', ref.title).gte('created_at', minTime).lte('created_at', maxTime);
    return NextResponse.json({ ok: true, deleted_count: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
