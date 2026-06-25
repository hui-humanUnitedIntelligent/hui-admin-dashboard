// GET /api/kpis/growth — Nutzerwachstum (letzte 6 Monate, read-only)
import { guardUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const guard = await guardUser(req);
  if (guard) return guard;
  try {
    const sb  = getServiceClient();
    const now = new Date();
    const months: { label: string; start: string; end: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        start: d.toISOString(),
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString(),
      });
    }
    const results = await Promise.all(months.map(m =>
      sb.from('profiles').select('id', { count: 'exact', head: true })
        .gte('created_at', m.start).lt('created_at', m.end)
    ));
    const data = months.map((m, i) => ({ label: m.label, count: results[i].count ?? 0 }));
    return ok(data);
  } catch (e) { return serverError(e instanceof Error ? e.message : 'Fehler'); }
}
