// frontend/src/app/api/reviews/route.ts
// App-Kommentare: works, experiences (zukuenftig auch projects)
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const SENSITIVE_CACHE: { keywords: string[]; ts: number } = { keywords: [], ts: 0 };

async function getSensitiveKeywords(sb: ReturnType<typeof import('@/app/lib/supabase-server').getServiceClient>): Promise<string[]> {
  if (Date.now() - SENSITIVE_CACHE.ts < 300_000 && SENSITIVE_CACHE.keywords.length) return SENSITIVE_CACHE.keywords;
  const { data } = await sb.from('sensitive_keywords').select('keyword');
  const kws = (data ?? []).map((k: { keyword: string }) => k.keyword.toLowerCase());
  SENSITIVE_CACHE.keywords = kws;
  SENSITIVE_CACHE.ts = Date.now();
  return kws;
}

function detectSensitive(text: string, keywords: string[]): { flagged: boolean; matches: string[] } {
  const lower = text.toLowerCase();
  const matches = keywords.filter(k => lower.includes(k));
  return { flagged: matches.length > 0, matches };
}

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // all | sensitive
    const sb = getServiceClient();

    // Kommentare auf Werke
    let q = sb.from('comments')
      .select('id,work_id,user_id,text,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (search) q = q.ilike('text', `%${search}%`);
    const { data: comments, count } = await q;

    // Werke-Titel und Profile nachladen
    const workIds = [...new Set((comments ?? []).map((c: {work_id: string}) => c.work_id).filter(Boolean))];
    const userIds = [...new Set((comments ?? []).map((c: {user_id: string}) => c.user_id).filter(Boolean))];
    const [worksRes, profilesRes, keywordsArr] = await Promise.all([
      workIds.length ? sb.from('works').select('id,title,type').in('id', workIds) : Promise.resolve({ data: [] }),
      userIds.length ? sb.from('profiles').select('id,display_name,username,avatar_url').in('id', userIds) : Promise.resolve({ data: [] }),
      getSensitiveKeywords(sb),
    ]);

    const workMap = new Map((worksRes.data ?? []).map((w: {id:string;title:string;type:string}) => [w.id, w]));
    const profMap = new Map((profilesRes.data ?? []).map((p: {id:string;display_name:string;username:string;avatar_url:string}) => [p.id, p]));

    const reviews = (comments ?? []).map((c: {id:string;work_id:string;user_id:string;text:string;created_at:string}) => {
      const prof = profMap.get(c.user_id) as {display_name?:string;username?:string;avatar_url?:string}|undefined;
      const work = workMap.get(c.work_id) as {title?:string;type?:string}|undefined;
      const sens = detectSensitive(c.text, keywordsArr);
      return {
        id: c.id, source: 'works',
        refId: c.work_id, refTitle: work?.title ?? null, refType: work?.type ?? 'work',
        userId: c.user_id,
        userName: prof?.display_name || prof?.username || 'Anonym',
        userAvatar: prof?.avatar_url ?? null,
        text: c.text,
        createdAt: c.created_at,
        sensitive: sens.flagged,
        sensitiveMatches: sens.matches,
      };
    });

    const filtered = filter === 'sensitive' ? reviews.filter(r => r.sensitive) : reviews;
    const sensitiveCount = reviews.filter(r => r.sensitive).length;

    return NextResponse.json({ reviews: filtered, total: count ?? 0, sensitiveCount });
  } catch (err) {
    console.error('[reviews GET]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;
  try {
    const { id, text } = await req.json();
    if (!id || !text?.trim()) return NextResponse.json({ ok: false, error: 'id + text erforderlich' }, { status: 400 });
    const sb = getServiceClient();
    const { error } = await sb.from('comments').update({ text: text.trim() }).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
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
