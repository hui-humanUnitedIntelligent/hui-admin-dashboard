// frontend/src/app/api/impact-projects/route.ts
import { NextRequest } from 'next/server';
import { guardUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await guardUser(req);
  if (guard) return guard;

  try {
    const sb     = getServiceClient();
    const params = new URL(req.url).searchParams;
    const status = params.get('status');
    const limit  = Math.min(Number(params.get('limit') ?? 500), 1000);
    const skip   = Number(params.get('skip') ?? 0);

    let query = sb
      .from('impact_projects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const all = data ?? [];
    const counts = {
      total:   count ?? 0,
      active:  all.filter(r => r.status === 'active').length,
      inactive: all.filter(r => r.status === 'inactive').length,
      deleted: all.filter(r => r.status === 'deleted').length,
    };

    return ok({ projects: all, total: count ?? 0, counts });
  } catch (err) {
    return serverError(err, 'impact-projects GET');
  }
}
