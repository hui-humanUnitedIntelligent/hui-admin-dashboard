// GET /api/kpis/revenue — Umsatzstatistiken (read-only)
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [total, monthly] = await Promise.all([
      sb.from('payments').select('amount').eq('status', 'completed'),
      sb.from('payments').select('amount').eq('status', 'completed').gte('created_at', startOfMonth),
    ]);
    const sumAll     = (total.data   ?? []).reduce((a: number, p: {amount: number}) => a + (p.amount ?? 0), 0);
    const sumMonthly = (monthly.data ?? []).reduce((a: number, p: {amount: number}) => a + (p.amount ?? 0), 0);
    return ok({ total: sumAll, monthly: sumMonthly, transactions: total.data?.length ?? 0 });
  } catch (e) { return serverError(e instanceof Error ? e.message : 'Fehler'); }
}
