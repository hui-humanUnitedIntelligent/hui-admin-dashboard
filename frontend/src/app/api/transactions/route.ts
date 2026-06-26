// frontend/src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin, guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '1000'), 5000);
    const status = searchParams.get('status') || 'all';

    const sb = getServiceClient();
    let query = sb
      .from('payments')
      .select('id,user_id,amount_eur,status,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const payments = data ?? [];
    const totalRevenue = payments
      .filter(p => p.status === 'completed')
      .reduce((s, p) => s + (p.amount_eur ?? 0), 0);

    return NextResponse.json({ payments, total: payments.length, totalRevenue });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
