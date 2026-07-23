// frontend/src/app/api/momente/route.ts
// MOMENTE-REPORTS-001: Admin-API für Momente-Verwaltung
import { NextResponse, NextRequest } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

const BEITRAG_SELECT = `
  id, user_id, type, caption, src, created_at, status,
  profiles!user_id(full_name, username, avatar_url)
`;

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';
  const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

  const sb = getServiceClient();

  // Momente laden (beitraege = Momente-Tabelle)
  let q = sb.from('beitraege')
    .select(BEITRAG_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') q = q.eq('status', status);
  if (search)           q = q.ilike('caption', `%${search}%`);

  const { data, count, error } = await q;
  if (error) {
    console.error('[momente GET]', error);
    return NextResponse.json({ entries: [], total: 0 }, { status: 500 });
  }

  // Report-Counts für alle geladenen Momente
  const ids = (data ?? []).map(e => e.id);
  let reportMap: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: reports } = await sb
      .from('momente_reports')
      .select('moment_id')
      .in('moment_id', ids);
    (reports ?? []).forEach(r => {
      reportMap[r.moment_id] = (reportMap[r.moment_id] ?? 0) + 1;
    });
  }

  // Parallel: Zähler für KPI-Kacheln
  const [allC, pubC, repC, delC] = await Promise.all([
    sb.from('beitraege').select('id', { count:'exact', head:true }),
    sb.from('beitraege').select('id', { count:'exact', head:true }).not('status', 'in', '("reported","deleted")'),
    sb.from('beitraege').select('id', { count:'exact', head:true }).eq('status', 'reported'),
    sb.from('beitraege').select('id', { count:'exact', head:true }).eq('status', 'deleted'),
  ]);

  const entries = (data ?? []).map(e => {
    const prof = (e as any).profiles;
    return {
      id:                 e.id,
      initiator_id:       e.user_id,
      initiator_name:     prof?.full_name   ?? null,
      initiator_username: prof?.username    ?? null,
      initiator_avatar:   prof?.avatar_url  ?? null,
      caption:            e.caption         ?? null,
      moment_type:        e.type            ?? null,
      status:             e.status          ?? 'active',
      created_at:         e.created_at,
      report_count:       reportMap[e.id]   ?? 0,
    };
  });

  return NextResponse.json({
    entries,
    total:  count ?? 0,
    counts: {
      all:      allC.count ?? 0,
      public:   pubC.count ?? 0,
      reported: repC.count ?? 0,
      deleted:  delC.count ?? 0,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { id, action } = await req.json();
    if (!id || !action) return NextResponse.json({ ok: false, error: 'id + action erforderlich' }, { status: 400 });

    const sb = getServiceClient();
    let updates: Record<string, unknown> = {};

    if (action === 'delete')  updates.status = 'deleted';
    if (action === 'restore') updates.status = 'active';

    if (Object.keys(updates).length === 0)
      return NextResponse.json({ ok: false, error: `Unbekannte Aktion: ${action}` }, { status: 400 });

    const { error } = await sb.from('beitraege').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
