// frontend/src/app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const sb  = getServiceClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOf12Months = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

    // ── Alle Queries parallel ─────────────────────────────────────────────────
    const [
      profilesRes,
      worksRes,
      paymentsMonthRes,
      paymentsAllRes,
      impactProjectsRes,
      ambassadorsRes,
      recentUsersRes,
      growthRes,
      recentPaymentsRes,
    ] = await Promise.all([
      // 1) Alle Profile (keine Filterung — geblockte zählen MIT)
      sb.from('profiles')
        .select('id, is_wirker, role, is_member, membership_active, is_ambassador, created_at, blocked', { count: 'exact' })
        .limit(5000),

      // 2) Werke (published)
      sb.from('works').select('id', { count: 'exact' }).eq('status', 'published'),

      // 3) Payments diesen Monat — Single Source of Truth: stripe_payments
      sb.from('stripe_payments')
        .select('id, amount, status, created_at')
        .eq('status', 'succeeded')
        .gte('created_at', startOfMonth)
        .limit(5000),

      // 4) Alle Payments total (succeeded)
      sb.from('stripe_payments').select('id', { count: 'exact' }).eq('status', 'succeeded'),

      // 5) Impact Projekte
      sb.from('impact_projects')
        .select('id, name, status, votes, awarded_eur, category')
        .order('votes', { ascending: false })
        .limit(50),

      // 6) Ambassadors
      sb.from('profiles')
        .select('id, is_ambassador', { count: 'exact' })
        .eq('is_ambassador', true),

      // 7) Neueste 8 User
      sb.from('profiles')
        .select('id, display_name, full_name, username, email, role, is_wirker, created_at, avatar_url')
        .order('created_at', { ascending: false })
        .limit(8),

      // 8) Growth: alle Profile der letzten 12 Monate
      sb.from('profiles')
        .select('created_at')
        .gte('created_at', startOf12Months)
        .limit(5000),

      // 9) Letzte 8 Zahlungen — Single Source of Truth: stripe_payments
      sb.from('stripe_payments')
        .select('id, stripe_payment_id, amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    // ── Auth-User für genaue Gesamtzahl (alle Seiten) ───────────────────────
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    let authTotal = 0;
    try {
      // Supabase liefert kein total-Feld — alle Seiten laden
      let page = 1;
      const perPage = 1000;
      while (true) {
        const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
          headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
        });
        const authData = await authRes.json() as { users?: unknown[] };
        const batch = authData.users ?? [];
        authTotal += batch.length;
        if (batch.length < perPage) break;
        page++;
      }
    } catch { /* fallback auf profiles */ }

    // ── Berechnungen ─────────────────────────────────────────────────────────
    const profiles      = profilesRes.data ?? [];
    const profileCount  = profilesRes.count ?? profiles.length;

    // Gesamtnutzer = auth.users (authoritativ); fallback: profiles
    const totalUsers    = authTotal > 0 ? authTotal : profileCount;
    const activeUsers   = profiles.filter(p => !p.blocked).length;
    const blockedUsers  = profiles.filter(p =>  p.blocked).length;
    const activeWirker  = profiles.filter(p => p.is_wirker).length;
    const activeMembers = profiles.filter(p => p.is_member || p.membership_active).length;

    // Stripe-Beträge sind in Cent gespeichert → /100 für EUR
    const monthlyRevenue = (paymentsMonthRes.data ?? []).reduce((s, p) => s + ((p.amount ?? 0) / 100), 0);
    const totalPayments  = paymentsAllRes.count ?? 0;
    const activeAmbassadors = ambassadorsRes.count ?? 0;

    // Impact Pool: live aus stripe_impact_pool (aktueller Monat) — keine lokale Berechnung
    const currentPoolMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { data: poolRow } = await sb
      .from('stripe_impact_pool')
      .select('total_inflow, project_share, company_share')
      .eq('month', currentPoolMonth)
      .maybeSingle();
    const impactPool     = (poolRow?.total_inflow   ?? 0) / 100; // Brutto-Pool (15% vom Umsatz)
    const projectShareEur = (poolRow?.project_share ?? 0) / 100; // 15% davon → Projekte
    const companyShareEur = (poolRow?.company_share ?? 0) / 100; // 85% davon → Firma

    // ── Growth Chart ─────────────────────────────────────────────────────────
    const growthData = growthRes.data ?? [];
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return {
        label: d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        start: d,
      };
    });
    const newUsersPerMonth = months.map(({ start }, idx) => {
      const end = idx < months.length - 1 ? months[idx + 1].start : new Date();
      return growthData.filter(p => {
        const d = new Date(p.created_at as string);
        return d >= start && d < end;
      }).length;
    });
    const cumulativeUsers = newUsersPerMonth.map((_, i) =>
      newUsersPerMonth.slice(0, i + 1).reduce((s, v) => s + v, 0)
    );

    // Für's UI-Format (id, amount_eur, status, created_at) auf stripe_payments mappen
    const recentPaymentsMapped = (recentPaymentsRes.data ?? []).map((p: { id: string; stripe_payment_id?: string; amount?: number; status: string; created_at: string }) => ({
      id:         p.stripe_payment_id ?? p.id,
      amount_eur: (p.amount ?? 0) / 100,
      status:     p.status,
      created_at: p.created_at,
    }));

    return NextResponse.json({
      kpis: {
        totalUsers,      // auth.users — Single Source of Truth
        activeUsers,     // profiles ohne blocked
        blockedUsers,    // profiles mit blocked=true
        activeWirker,
        activeMembers,
        totalWorks:      worksRes.count ?? 0,
        monthlyRevenue,
        impactPool,
        projectShareEur,
        companyShareEur,
        totalPayments,
        activeBookings:  0,
        activeAmbassadors,
        pendingAmbassadors: 0,
        totalReferrals:  0,
      },
      recentUsers:    recentUsersRes.data ?? [],
      recentPayments: recentPaymentsMapped,
      impactProjects: impactProjectsRes.data ?? [],
      growth: {
        labels:      months.map(m => m.label),
        newUsers:    newUsersPerMonth,
        activeUsers: cumulativeUsers,
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dashboard GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
