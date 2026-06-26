// frontend/src/app/api/experiences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee, guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const SUBMITTED_STATES = ['submitted', 'pending', 'pending_review', 'review', 'waiting_for_approval'];

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const filter  = searchParams.get('filter') || 'all';
    const limit   = Math.min(parseInt(searchParams.get('limit')  || '100'), 500);
    const offset  = parseInt(searchParams.get('offset') || '0');
    const sb = getServiceClient();

    let q = sb.from('experiences').select('*', { count: 'exact' });
    if (filter === 'active')         q = q.eq('status', 'published');
    else if (filter === 'submitted') q = q.in('status', SUBMITTED_STATES);
    else if (filter === 'rejected')  q = q.eq('status', 'rejected');
    else if (filter === 'deleted')   q = q.eq('status', 'deleted');
    else                             q = q.neq('status', 'deleted');

    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, count, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const userIds = [...new Set((data ?? []).map((e: { user_id: string }) => e.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await sb.from('profiles').select('id,display_name,avatar_url,email').in('id', userIds)
      : { data: [] };
    const profMap = new Map((profiles ?? []).map(p => [p.id, p]));
    const experiences = (data ?? []).map((e: Record<string,unknown>) => ({ ...e, author: profMap.get(e.user_id as string) ?? null }));

    return NextResponse.json({ experiences, total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { id, status, rejection_reason } = await req.json();
    if (!id || !status) return NextResponse.json({ ok: false, error: 'id und status erforderlich' }, { status: 400 });
    const sb = getServiceClient();
    const updates: Record<string,unknown> = { status };
    if (status === 'published') updates.visibility = 'public';
    if (status === 'rejected')  { updates.visibility = 'private'; if (rejection_reason) updates.rejection_reason = rejection_reason; }
    if (status === 'deleted')   updates.visibility = 'private';
    const { error } = await sb.from('experiences').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
