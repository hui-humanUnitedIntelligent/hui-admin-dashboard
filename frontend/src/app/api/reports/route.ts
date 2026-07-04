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

// REPORTS-LIVE-FIX (2026-07-04): 'Umsatz'/'Impact'/'Netto-Impact' zeigten immer 0,00 €,
// weil die Route ausschließlich aus der toten Legacy-Tabelle 'payments' las (nie befüllt,
// SYS-LegacyMark-024 -- gleiches Muster wie der Dashboard-Bug aus ADMIN-TX-FIX). Fix:
// Umsatz jetzt aus 'stripe_payments' (status='succeeded', SSOT für alle Zahlungen), Impact-
// Zahlen direkt aus den bereits von rpc_process_order_fees berechneten+gespeicherten Werten
// in 'stripe_impact_pool' -- keine eigene Ratenberechnung/Neuerfindung, nur echte, live
// gespeicherte Beträge pro Periode summiert.
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
      { data: profiles     = [] },
      { data: stripePayments = [] },
      { data: impactPoolRows = [] },
      { data: works        = [] },
      { data: bookings     = [] },
      { data: experiences  = [] },
    ] = await Promise.all([
      sb.from('profiles').select('created_at,is_wirker,is_member').limit(10000),
      // SSOT für Umsatz: stripe_payments (siehe REPORTS-LIVE-FIX oben)
      sb.from('stripe_payments').select('created_at,amount,status').limit(10000),
      // SSOT für Impact-Pool-Zahlen: echte, pro Bestellung von rpc_process_order_fees
      // gespeicherte Werte (total_inflow=Gesamt-Gebühr, project_share=Netto-Impact,
      // company_share=Firmenanteil nach Ambassador-Provision)
      sb.from('stripe_impact_pool').select('created_at,total_inflow,project_share,company_share').limit(10000),
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

    const safeProfiles    = (profiles       ?? []) as Array<{ created_at: string; is_wirker?: boolean; is_member?: boolean }>;
    const safePayments    = (stripePayments ?? []) as Array<{ created_at: string; amount?: number; status?: string }>;
    const safePool        = (impactPoolRows ?? []) as Array<{ created_at: string; total_inflow?: number; project_share?: number; company_share?: number }>;
    const safeWorks       = (works       ?? []) as Array<{ created_at: string }>;
    const safeBookings    = (bookings    ?? []) as Array<{ created_at: string }>;
    const safeExperiences = (experiences ?? []) as Array<{ created_at: string }>;

    const reportPeriods = periodKeys.map(pk => {
      const pProf = safeProfiles.filter(x => keyFn(x.created_at) === pk);
      const pPay  = safePayments.filter(x => keyFn(x.created_at) === pk && x.status === 'succeeded');
      const pPool = safePool.filter(x => keyFn(x.created_at) === pk);
      const pWrk  = safeWorks.filter(x => keyFn(x.created_at) === pk);
      const pBk   = safeBookings.filter(x => keyFn(x.created_at) === pk);
      const pExp  = safeExperiences.filter(x => keyFn(x.created_at) === pk);

      // Beträge in stripe_payments/stripe_impact_pool sind in Cent gespeichert → /100 für EUR
      const revenue       = pPay.reduce((s, p) => s + ((Number(p.amount) || 0) / 100), 0);
      const impact_pool   = pPool.reduce((s, p) => s + ((Number(p.total_inflow)   || 0) / 100), 0);
      const net_impact    = pPool.reduce((s, p) => s + ((Number(p.project_share)  || 0) / 100), 0);
      const company_share = pPool.reduce((s, p) => s + ((Number(p.company_share)  || 0) / 100), 0);

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

    const succeededPayments = safePayments.filter(p => p.status === 'succeeded');
    const totals = {
      users:    safeProfiles.length,
      wirker:   safeProfiles.filter(p => p.is_wirker).length,
      members:  safeProfiles.filter(p => p.is_member).length,
      works:    safeWorks.length,
      experiences: safeExperiences.length,
      bookings: safeBookings.length,
      transactions: succeededPayments.length,
      revenue:  succeededPayments.reduce((s, p) => s + ((Number(p.amount) || 0) / 100), 0),
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
