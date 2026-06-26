// frontend/src/app/api/impact-projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || '';
    const sb = getServiceClient();

    let q = sb.from('impact_projects')
      .select('id,created_at,updated_at,name,category,description,icon,color,votes,status,month,awarded_eur,website,contact_name,contact_email,impact_report,tags,distributed_at', { count: 'exact' });
    if (status) q = q.eq('status', status);
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, count, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, projects: data ?? [], total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'ID fehlt' }, { status: 400 });
    const sb = getServiceClient();
    const { error } = await sb.from('impact_projects').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
