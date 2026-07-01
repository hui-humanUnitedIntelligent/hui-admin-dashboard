// frontend/src/app/api/transactions/route.ts
// ARCH-006.1 — Single Source of Truth: alle 5 stripe_* Tabellen via rpc_get_all_transactions.
// Ersetzt die alte, tote 'payments'-Tabellen-Abfrage (Legacy, nie befüllt).
// guardEmployee erlaubt sowohl Admin (SADB) als auch Employee (EDB) — RLS-Schutz über Auth-Gate.
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter') || searchParams.get('status') || 'all';
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam) : null;

    const sb = getServiceClient();
    const { data, error } = await sb.rpc('rpc_get_all_transactions', {
      p_filter: filter,
      p_days:   days,
      p_limit:  limit,
      p_offset: offset,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error || 'unknown' }, { status: 500 });

    const transactions = data.transactions ?? [];
    const totalVolume = transactions
      .filter((t: { record_type: string; status: string }) => t.record_type === 'payment' && t.status === 'succeeded')
      .reduce((s: number, t: { amount: number }) => s + (t.amount ?? 0), 0);
    const totalImpact = transactions
      .reduce((s: number, t: { impact_share: number | null }) => s + (t.impact_share ?? 0), 0);
    const completed = transactions.filter((t: { status: string }) => t.status === 'succeeded' || t.status === 'active' || t.status === 'paid').length;

    return NextResponse.json({
      ok: true,
      transactions,
      total: data.total,
      limit: data.limit,
      offset: data.offset,
      totalVolume,
      totalImpact,
      completed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const body = await req.json();
    const { row_id, record_type } = body;
    if (!row_id) return NextResponse.json({ ok: false, error: 'row_id erforderlich' }, { status: 400 });

    const sb = getServiceClient();
    const { data, error } = await sb.rpc('rpc_get_transaction_details', {
      p_row_id: row_id,
      p_record_type: record_type || 'payment',
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
