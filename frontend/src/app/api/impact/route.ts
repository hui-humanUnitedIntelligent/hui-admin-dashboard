// frontend/src/app/api/impact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const type   = searchParams.get('type')   || 'projects'; // 'projects' | 'applications'
    const status = searchParams.get('status') || 'all';
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '200'), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const sb = getServiceClient();

    if (type === 'applications') {
      let query = sb
        .from('impact_applications')
        .select('id,user_id,project_name,short_desc,status,submitted_at,created_at,reviewed_at,admin_comment,review_note,rejection_reason,rejected_at,reviewed_by,cover_url,contact_name,contact_email,funding_goal,location,website')
        .order('created_at', { ascending: false });

      if (status !== 'all') query = query.eq('status', status);

      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ applications: data ?? [], total: data?.length ?? 0 });
    }

    // type === 'projects'
    let query = sb
      .from('impact_projects')
      .select('id,name,category,description,icon,color,status,votes,month,awarded_eur,website,contact_name,contact_email,tags,created_at,updated_at,distributed_at')
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ projects: data ?? [], total: data?.length ?? 0 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { id, type, ...updates } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id fehlt' }, { status: 400 });

    const table = type === 'applications' ? 'impact_applications' : 'impact_projects';
    const sb = getServiceClient();
    const { error } = await sb.from(table).update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
