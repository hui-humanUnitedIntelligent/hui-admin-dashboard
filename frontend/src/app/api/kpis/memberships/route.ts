// GET /api/kpis/memberships — Mitgliedschaftsstatistiken (read-only)
import { guardUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const guard = await guardUser(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();
    const [total, active] = await Promise.all([
      sb.from('memberships').select('id', { count: 'exact', head: true }),
      sb.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);
    return ok({ total: total.count??0, active: active.count??0 });
  } catch (e) { return serverError(e instanceof Error ? e.message : 'Fehler'); }
}
