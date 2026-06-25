// GET /api/kpis/users — Nutzerstatistiken (read-only)
import { guardUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const guard = await guardUser(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();
    const now = new Date();
    const ago30 = new Date(now.getTime() - 30*24*60*60*1000).toISOString();
    const [total, active] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('last_login', ago30),
    ]);
    return ok({ total: total.count ?? 0, active: active.count ?? 0 });
  } catch (e) { return serverError(e instanceof Error ? e.message : 'Fehler'); }
}
