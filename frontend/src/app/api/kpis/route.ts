// frontend/src/app/api/kpis/route.ts
// KPI-Daten für SADB und EDB — zugänglich für alle eingeloggten Nutzer
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const sb = getServiceClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Parallel laden — Payments: Single Source of Truth ist stripe_payments (ARCH-006.1)
    const currentPoolMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [
      profilesRes,
      worksRes,
      membershipsRes,
      paymentsRes,
      bookingsRes,
      poolRes,
    ] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('works').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      sb.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('stripe_payments').select('amount').eq('status', 'succeeded').gte('created_at', startOfMonth),
      sb.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
      sb.from('stripe_impact_pool').select('total_inflow, project_share, company_share').eq('month', currentPoolMonth).maybeSingle(),
    ]);

    const totalUsers    = profilesRes.count   ?? 0;
    const totalWorks    = worksRes.count       ?? 0;
    const activeMembers = membershipsRes.count ?? 0;
    const activeBookings = bookingsRes.count   ?? 0;

    // Stripe-Beträge sind in Cent gespeichert → /100 für EUR
    const payments = paymentsRes.data ?? [];
    const monthlyRevenue = payments.reduce((s: number, p: { amount?: number }) => s + ((p.amount ?? 0) / 100), 0);

    // Impact Pool: live aus stripe_impact_pool — keine lokale Berechnung
    const pool = poolRes.data as { total_inflow?: number; project_share?: number; company_share?: number } | null;
    const impactPool      = (pool?.total_inflow  ?? 0) / 100; // Brutto-Pool (15% vom Umsatz)
    const projectShareEur = (pool?.project_share ?? 0) / 100; // 15% davon → Projekte
    const companyShareEur = (pool?.company_share ?? 0) / 100; // 85% davon → Firma

    // Aktive User (letzten 30 Tage)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { count: activeUsers } = await sb
      .from('profiles').select('id', { count: 'exact', head: true })
      .gte('last_seen_at', thirtyDaysAgo);

    // Nutzerwachstum — letzte 6 Monate
    const growth: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const { count } = await sb
        .from('profiles').select('id', { count: 'exact', head: true })
        .gte('created_at', from).lte('created_at', to);
      growth.push({
        month: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        count: count ?? 0,
      });
    }

    return NextResponse.json({
      totalUsers,
      activeUsers:    activeUsers   ?? 0,
      totalWorks,
      activeMembers,
      activeBookings,
      monthlyRevenue,
      impactPool,
      projectShareEur,
      companyShareEur,
      growth,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[kpis GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
