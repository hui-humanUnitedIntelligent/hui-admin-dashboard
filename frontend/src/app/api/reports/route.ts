// frontend/src/app/api/reports/route.ts
// Generates weekly/monthly reports from live Supabase data

import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

function monthKey(iso: string) { return iso?.slice(0, 7) || ''; }
function weekKey(iso: string) {
  const d = new Date(iso);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function fetchAll(table: string, select: string) {
  const res = await fetch(`${SUPA}/rest/v1/${table}?select=${select}&limit=5000&order=created_at.desc`, { headers: H });
  return res.json().catch(() => []);
}

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No key' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'monthly'; // weekly | monthly
  const periods = parseInt(searchParams.get('periods') || '6');

  const [profiles, payments, works, bookings] = await Promise.all([
    fetchAll('profiles',  'id,created_at,role,is_wirker,is_member,membership_type,display_name'),
    fetchAll('payments',  'id,created_at,amount_eur,impact_eur,status,state'),
    fetchAll('works',     'id,created_at,status,price_eur'),
    fetchAll('bookings',  'id,created_at'),
  ]);

  // Build period keys
  const now = new Date();
  const periodKeys: string[] = [];
  for (let i = periods - 1; i >= 0; i--) {
    if (type === 'monthly') {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periodKeys.push(d.toISOString().slice(0, 7));
    } else {
      // weekly: go back i weeks
      const d = new Date(now.getTime() - i * 7 * 86400000);
      periodKeys.push(weekKey(d.toISOString()));
    }
  }

  const keyFn = type === 'monthly' ? monthKey : weekKey;

  const reports = periodKeys.map(pk => {
    const pProfiles  = (profiles  as {created_at:string;role:string;is_wirker:boolean;is_member:boolean}[]).filter(x => keyFn(x.created_at) === pk);
    const pPayments  = (payments  as {created_at:string;amount_eur:number;impact_eur:number;state:string}[]).filter(x => keyFn(x.created_at) === pk);
    const pWorks     = (works     as {created_at:string}[]).filter(x => keyFn(x.created_at) === pk);
    const pBookings  = (bookings  as {created_at:string}[]).filter(x => keyFn(x.created_at) === pk);

    const revenue    = pPayments.filter(p => p.state === 'completed' || p.amount_eur > 0).reduce((s, p) => s + (p.amount_eur || 0), 0);
    const impact     = revenue * 0.15;
    const netImpact  = impact * 0.85;
    const compShare  = impact * 0.15;

    return {
      period: pk,
      new_users:      pProfiles.length,
      new_wirker:     pProfiles.filter(p => p.is_wirker).length,
      new_members:    pProfiles.filter(p => p.is_member).length,
      new_works:      pWorks.length,
      new_bookings:   pBookings.length,
      transactions:   pPayments.length,
      revenue:        Math.round(revenue * 100) / 100,
      impact_pool:    Math.round(impact * 100) / 100,
      net_impact:     Math.round(netImpact * 100) / 100,
      company_share:  Math.round(compShare * 100) / 100,
    };
  });

  // Totals
  const totals = {
    users:      (profiles as {id:string}[]).length,
    wirker:     (profiles as {is_wirker:boolean}[]).filter(p => p.is_wirker).length,
    members:    (profiles as {is_member:boolean}[]).filter(p => p.is_member).length,
    works:      (works as {id:string}[]).length,
    bookings:   (bookings as {id:string}[]).length,
  };

  return NextResponse.json({ type, periods: reports, totals, generated_at: new Date().toISOString() });
}
