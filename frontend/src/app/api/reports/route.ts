// frontend/src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

function monthKey(iso: string) { return (iso ?? '').slice(0, 7); }
function weekKey(iso: string) {
  const d    = new Date(iso);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const type    = searchParams.get('type')    ?? 'monthly';
    const periods = Math.min(parseInt(searchParams.get('periods') ?? '6', 10), 24);
    const sb      = getServiceClient();
    const keyFn   = type === 'monthly' ? monthKey : weekKey;
    const now     = new Date();

    // Alle Rohdaten laden
    const [
      { data: profiles  = [] },
      { data: payments  = [] },
      { data: works     = [] },
      { data: bookings  = [] },
      { data: experiences = [] },
    ] = await Promise.all([
      sb.from('profiles').select('created_at,is_wirker,is_member').limit(10000),
      sb.from('payments').select('created_at,amount,status').limit(10000),
      sb.from('works').select('created_at').limit(10000),
      sb.from('bookings').select('created_at').limit(10000),
      sb.from('experiences').select('created_at').limit(10000),
    ]);

    // Perioden-Keys aufbauen
    const periodKeys: string[] = [];
    for (let i = periods - 1; i >= 0; i--) {
      if (type === 'monthly') {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periodKeys.push(d.toISOString().slice(0, 7));
      } else {
        const d = new Date(now.getTime() - i * 7 * 86400000);
        periodKeys.push(weekKey(d.toISOString()));
      }
    }

    const safeProfiles    = (profiles    ?? []) as Array<{ created_at: string; is_wirker?: boolean; is_member?: boolean }>;
    const safePayments    = (payments    ?? []) as Array<{ created_at: string; amount?: number; status?: string }>;
    const safeWorks       = (works       ?? []) as Array<{ created_at: string }>;
    const safeBookings    = (bookings    ?? []) as Array<{ created_at: string }>;
    const safeExperiences = (experiences ?? []) as Array<{ created_at: string }>;

    const reportPeriods = periodKeys.map(pk => {
      const pProf = safeProfiles.filter(x => keyFn(x.created_at) === pk);
      const pPay  = safePayments.filter(x => keyFn(x.created_at) === pk);
      const pWrk  = safeWorks.filter(x => keyFn(x.created_at) === pk);
      const pBk   = safeBookings.filter(x => keyFn(x.created_at) === pk);
      const pExp  = safeExperiences.filter(x => keyFn(x.created_at) === pk);

      const revenue      = pPay.filter(p => p.status === 'completed').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const impact_pool  = revenue * 0.15;
      const net_impact   = impact_pool * 0.85;
      const company_share = impact_pool * 0.15;

      return {
        period:        pk,
        new_users:     pProf.length,
        new_wirker:    pProf.filter(p => p.is_wirker).length,
        new_members:   pProf.filter(p => p.is_member).length,
        new_works:     pWrk.length,
        new_experiences: pExp.length,
        new_bookings:  pBk.length,
        transactions:  pPay.length,
        revenue,
        impact_pool,
        net_impact,
        company_share,
      };
    });

    const totals = {
      users:    safeProfiles.length,
      wirker:   safeProfiles.filter(p => p.is_wirker).length,
      members:  safeProfiles.filter(p => p.is_member).length,
      works:    safeWorks.length,
      experiences: safeExperiences.length,
      bookings: safeBookings.length,
      transactions: safePayments.length,
      revenue:  safePayments.filter(p => p.status === 'completed').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    };

    return NextResponse.json({
      data: {
        type,
        periods:      reportPeriods,
        totals,
        generated_at: new Date().toISOString(),
      }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
