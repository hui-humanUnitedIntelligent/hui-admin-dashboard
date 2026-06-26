// frontend/src/app/api/works/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const search = (searchParams.get('search') || '').toLowerCase();
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '200'), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const sb = getServiceClient();

    let query = sb
      .from('works')
      .select('id,user_id,title,description,category,price_eur,price,status,cover_url,visibility,created_at,updated_at,published_at,approval_status,sensitivity_status,sensitivity_reason,admin_comment,review_note,rejection_reason,rejected_at,reviewed_at,reviewed_by,last_submitted_at,tags,post_type,media_type,views_count,likes_count,comments_count')
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);
    if (search)           query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ works: data ?? [], total: count ?? (data?.length ?? 0) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id fehlt' }, { status: 400 });

    const sb = getServiceClient();
    const { error } = await sb.from('works').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
