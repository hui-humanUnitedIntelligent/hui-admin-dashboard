// frontend/src/app/api/score-failures/route.ts
// GET: Alle Score-Failures (read-only, für Employee + Superadmin)
import { NextRequest } from 'next/server';
import { guardUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardUser(req);
  if (guard) return guard;

  try {
    const sb = getServiceClient();
    const params = new URL(req.url).searchParams;
    const limit  = Math.min(Number(params.get('limit') ?? 200), 500);

    const { data, error } = await sb
      .from('impact_score_failures')
      .select('id,user_id,project_name,short_desc,kategorie,funding_goal,ai_score,grund,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'Fehler beim Laden');
  }
}
