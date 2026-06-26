// frontend/src/app/api/experiences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin, guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const search = (searchParams.get('search') || '').toLowerCase();
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '200'), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const sb = getServiceClient();

    let query = sb
      .from('experiences')
      .select('id,user_id,title,description,category,price,status,cover_url,visibility,created_at,updated_at,approval_status,sensitivity_status,sensitivity_reason,admin_comment,review_note,rejection_reason,rejected_at,reviewed_at,reviewed_by,last_submitted_at,tags,experience_type,duration,participant_limit,language,location_text,mood_tags')
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);
    if (search)           query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ experiences: data ?? [], total: data?.length ?? 0 });
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
    const { error } = await sb.from('experiences').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
