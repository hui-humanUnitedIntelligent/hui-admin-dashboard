// frontend/src/app/api/score-failures/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const sb = getServiceClient();
    const { data, count } = await sb
      .from('impact_score_failures')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);
    return NextResponse.json({ ok: true, data: data ?? [], total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
