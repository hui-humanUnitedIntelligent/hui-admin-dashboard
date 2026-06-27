// frontend/src/app/api/reviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sb = getServiceClient();

    const { data: comments, count } = await sb
      .from('comments')
      .select('id,work_id,user_id,text,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const workIds  = [...new Set((comments ?? []).map((c: {work_id:string}) => c.work_id).filter(Boolean))];
    const userIds  = [...new Set((comments ?? []).map((c: {user_id:string}) => c.user_id).filter(Boolean))];

    const [worksRes, profilesRes] = await Promise.all([
      workIds.length
        ? sb.from('works').select('id,title').in('id', workIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? sb.from('profiles').select('id,display_name,username,avatar_url').in('id', userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const workMap = new Map((worksRes.data ?? []).map((w: {id:string;title:string}) => [w.id, w]));
    const profMap = new Map((profilesRes.data ?? []).map((p: {id:string;display_name:string;username:string;avatar_url:string}) => [p.id, p]));

    const reviews = (comments ?? []).map((c: {id:string;work_id:string;user_id:string;text:string;created_at:string}) => {
      const prof = profMap.get(c.user_id) as {display_name?:string;username?:string;avatar_url?:string} | undefined;
      const work = workMap.get(c.work_id) as {title?:string} | undefined;
      return {
        id:         c.id,
        workId:     c.work_id,
        workTitle:  work?.title ?? '\u2014',
        userId:     c.user_id,
        userName:   prof?.display_name || prof?.username || 'Unbekannt',
        userAvatar: prof?.avatar_url ?? null,
        text:       c.text,
        createdAt:  c.created_at,
      };
    });

    return NextResponse.json({ reviews, total: count ?? 0 });
  } catch (err) {
    console.error('[reviews GET]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id fehlt' }, { status: 400 });
    const sb = getServiceClient();
    const { error } = await sb.from('comments').delete().eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
