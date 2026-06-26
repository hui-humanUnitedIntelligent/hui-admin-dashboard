// frontend/src/app/api/impact-applications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const SUBMITTED = ['submitted','pending','pending_review','review','waiting_for_approval'];

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter') || 'all';
    const sb = getServiceClient();

    let q = sb.from('impact_applications')
      .select('*', { count: 'exact' });

    if (filter === 'submitted') q = q.in('status', SUBMITTED);
    else if (filter === 'approved') q = q.eq('status', 'published');
    else if (filter === 'rejected') q = q.eq('status', 'rejected');
    else if (filter === 'draft') q = q.eq('status', 'draft');

    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, count, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Profile nachladen
    const userIds = [...new Set((data ?? []).map((a: { user_id: string }) => a.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await sb.from('profiles').select('id,display_name,avatar_url,email').in('id', userIds)
      : { data: [] };
    const profMap = new Map((profiles ?? []).map(p => [p.id, p]));

    const enriched = (data ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      applicant: profMap.get(a.user_id as string) ?? null,
    }));

    return NextResponse.json({ ok: true, applications: enriched, total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { id, status, admin_comment } = await req.json();
    if (!id || !status) return NextResponse.json({ ok: false, error: 'Fehlende Parameter' }, { status: 400 });
    const sb = getServiceClient();
    const updates: Record<string,unknown> = { status };
    if (admin_comment) updates.admin_comment = admin_comment;
    const { error } = await sb.from('impact_applications').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
