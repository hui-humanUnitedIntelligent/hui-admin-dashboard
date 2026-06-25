// GET /api/kpis/works — Werkstatistiken (read-only)
import { guardUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const guard = await guardUser(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();
    const [total, published, draft] = await Promise.all([
      sb.from('works').select('id', { count: 'exact', head: true }),
      sb.from('works').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      sb.from('works').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    ]);
    return ok({ total: total.count??0, published: published.count??0, draft: draft.count??0 });
  } catch (e) { return serverError(e instanceof Error ? e.message : 'Fehler'); }
}
