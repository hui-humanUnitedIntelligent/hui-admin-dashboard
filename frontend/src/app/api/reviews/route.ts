// frontend/src/app/api/reviews/route.ts
// Hinweis: 'reviews' Tabelle existiert nicht in HUI — nutzt 'comments' aus works
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sb = getServiceClient();

    // comments + work-Titel joinen
    const { data: comments, count } = await sb
      .from('comments')
      .select('id,work_id,user_id,text,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Works und Profile nachladen für Display
    const workIds = [...new Set((comments ?? []).map(c => c.work_id).filter(Boolean))];
    const userIds = [...new Set((comments ?? []).map(c => c.user_id).filter(Boolean))];

    const [worksRes, profilesRes] = await Promise.all([
      workIds.length ? sb.from('works').select('id,title').in('id', workIds) : Promise.resolve({ data: [] }),
      userIds.length ? sb.from('profiles').select('id,display_name,avatar_url').in('id', userIds) : Promise.resolve({ data: [] }),
    ]);

    const workMap = new Map((worksRes.data ?? []).map(w => [w.id, w]));
    const profMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));

    const reviews = (comments ?? []).map(c => ({
      id:          c.id,
      workId:      c.work_id,
      workTitle:   workMap.get(c.work_id)?.title ?? '—',
      userId:      c.user_id,
      userName:    profMap.get(c.user_id)?.display_name ?? '—',
      userAvatar:  profMap.get(c.user_id)?.avatar_url ?? null,
      text:        c.text,
      createdAt:   c.created_at,
    }));

    return NextResponse.json({ reviews, total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
