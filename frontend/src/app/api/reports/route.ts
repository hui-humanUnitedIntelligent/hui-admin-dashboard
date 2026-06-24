// frontend/src/app/api/reports/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

function monthKey(iso: string) { return iso?.slice(0, 7) || ''; }
function weekKey(iso: string) {
  const d    = new Date(iso);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

type Profile  = { created_at: string; is_wirker: boolean; is_member: boolean };
type Payment  = { created_at: string; amount_eur: number; state: string };
type SimpleRec = { created_at: string };

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const type    = searchParams.get('type')    || 'monthly';
    const periods = Math.min(parseInt(searchParams.get('periods') || '6', 10), 24);

    const supabase = getServiceClient();

    const [
      { data: profiles  },
      { data: payments  },
      { data: works     },
      { data: bookings  },
    ] = await Promise.all([
      supabase.from('profiles').select('created_at,is_wirker,is_member').limit(10000),
      supabase.from('payments').select('created_at,amount_eur,state').limit(10000),
      supabase.from('works').select('created_at').limit(10000),
      supabase.from('bookings').select('created_at').limit(10000),
    ]);

    const keyFn = type === 'monthly' ? monthKey : weekKey;
    const now   = new Date();

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

    const reportPeriods = periodKeys.map(pk => {
      const pProfiles = (profiles as Profile[] ?? []).filter(x => keyFn(x.created_at) === pk);
      const pPayments = (payments as Payment[] ?? []).filter(x => keyFn(x.created_at) === pk);
      const pWorks    = (works    as SimpleRec[] ?? []).filter(x => keyFn(x.created_at) === pk);
      const pBookings = (bookings as SimpleRec[] ?? []).filter(x => keyFn(x.created_at) === pk);

      const revenue   = pPayments.filter(p => p.state === 'completed').reduce((s, p) => s + (p.amount_eur || 0), 0);
      const impact    = revenue * 0.15;

      return {
        period:       pk,
        newUsers:     pProfiles.length,
        newWirker:    pProfiles.filter(p => p.is_wirker).length,
        newMembers:   pProfiles.filter(p => p.is_member).length,
        newWorks:     pWorks.length,
        newBookings:  pBookings.length,
        transactions: pPayments.length,
        revenue:      Math.round(revenue * 100) / 100,
        impactPool:   Math.round(impact * 100) / 100,
        netImpact:    Math.round(impact * 0.85 * 100) / 100,
        companyShare: Math.round(impact * 0.15 * 100) / 100,
      };
    });

    return ok({
      type,
      periods:     reportPeriods,
      totals: {
        users:    (profiles  ?? []).length,
        wirker:   (profiles  as Profile[] ?? []).filter(p => p.is_wirker).length,
        members:  (profiles  as Profile[] ?? []).filter(p => p.is_member).length,
        works:    (works     ?? []).length,
        bookings: (bookings  ?? []).length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return serverError(err, 'reports GET');
  }
}
