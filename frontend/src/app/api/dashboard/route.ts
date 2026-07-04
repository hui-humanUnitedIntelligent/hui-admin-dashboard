// frontend/src/app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

// ARCH-006.1 Analytics-Konsolidierung: guardEmployee statt guardAdmin, damit SADB
// und EDB dieselbe Single-Source-of-Truth-Route nutzen koennen (keine zweite,
// separat berechnete Kennzahlen-Route mehr fuer Employees noetig -> /api/kpis entfernt).
//
// ADMIN-DASH-FIX (2026-07-04): Next.js cached GET-fetch-Aufrufe (die supabase-js
// fuer .from().select() intern macht) standardmaessig, sofern die Route nicht
// explizit als dynamisch/uncached markiert ist. rpc()-basierte Routes (z.B.
// /api/transactions) sind davon nicht betroffen (POST, nie automatisch gecacht) --
// deshalb aktualisierten sich Transaktionen live, das Dashboard hier aber nicht.
// force-dynamic + force-no-store erzwingen bei JEDEM Request frische Daten,
// passend zum "Live"-Badge/30s-Polling, das die UI bereits verspricht.
export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const sb  = getServiceClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOf12Months = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

    // ── Alle Queries parallel ─────────────────────────────────────────────────
    const day7  = new Date(now.getTime() - 7  * 86400000).toISOString();
    const day30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const day90 = new Date(now.getTime() - 90 * 86400000).toISOString();

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
      pendingAmbassadorsRes,
      bookings7Res,
      bookings30Res,
      bookings90Res,
      worksAllStatusRes,
      talentProfilesRes,
      projectApplicationsRes,
      bookingTypesRes,
      allPaymentsRes,
      ambassadorCommissionsRes,
    ] = await Promise.all([
      // 1) Alle Profile (keine Filterung — geblockte zählen MIT)
      sb.from('profiles')
        .select('id, is_wirker, role, is_member, membership_active, is_ambassador, created_at, blocked, referred_by, is_talent, location_label, membership_type', { count: 'exact' })
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

      // 10) Offene Ambassador-Anträge — Single Source of Truth: ambassadors_applications
      sb.from('ambassadors_applications').select('id', { count: 'exact' }).eq('status', 'offen'),

      // 11-13) Buchungsstatistik 7 / 30 / 90 Tage — Single Source of Truth: bookings
      sb.from('bookings').select('id, amount, created_at').gte('created_at', day7),
      sb.from('bookings').select('id, amount, created_at').gte('created_at', day30),
      sb.from('bookings').select('id, amount, created_at').gte('created_at', day90),

      // 14) Werk-Statistik nach Status
      sb.from('works').select('status'),

      // 15) Talent-Statistik
      sb.from('profiles').select('id', { count: 'exact' }).eq('is_talent', true),

      // 16) Projekt-Anträge nach Status — Single Source of Truth: impact_applications
      sb.from('impact_applications').select('status'),

      // 17) Buchungs-Verteilung nach Typ — Single Source of Truth: bookings
      sb.from('bookings').select('booking_type'),

      // 18) Alle Zahlungen (Typ + Status + Impact-Anteil) fuer Kauf-/Impact-/Zahlungs-Verteilung
      sb.from('stripe_payments').select('status, payment_type, impact_pool_share').limit(5000),

      // 19) Ambassador-Tier-Verteilung — je Ambassador der letzte (aktuelle) Tier-Stand
      sb.from('stripe_ambassador_commissions')
        .select('ambassador_id, tier, created_at')
        .order('created_at', { ascending: false })
        .limit(2000),
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
    const pendingAmbassadors = pendingAmbassadorsRes.count ?? 0;
    const totalReferrals  = profiles.filter(p => p.referred_by).length;

    // ── Buchungsstatistik 7 / 30 / 90 Tage — Single Source of Truth: bookings ──
    const sumAmt = (rows: { amount?: number | null }[]) => rows.reduce((s, r) => s + (r.amount ?? 0), 0);
    const bookingStats = {
      last7:  { count: bookings7Res.data?.length  ?? 0, revenue: sumAmt(bookings7Res.data  ?? []) },
      last30: { count: bookings30Res.data?.length ?? 0, revenue: sumAmt(bookings30Res.data ?? []) },
      last90: { count: bookings90Res.data?.length ?? 0, revenue: sumAmt(bookings90Res.data ?? []) },
    };
    const activeBookingsCount = (bookings90Res.data ?? []).length; // gesamt aktiv sichtbar (90-Tage-Fenster)

    // ── Talent-Statistik — profiles.is_talent (keine eigene Tabelle, ARCH-006.1) ──
    const talentStats = {
      total: talentProfilesRes.count ?? 0,
      percentOfUsers: profiles.length > 0 ? Math.round((talentProfilesRes.count ?? 0) / profiles.length * 100) : 0,
    };

    // ── Werk-Statistik nach Status ──────────────────────────────────────────
    const workStatusRows = worksAllStatusRes.data ?? [];
    const workStats = {
      published: workStatusRows.filter(w => w.status === 'published').length,
      pending:   workStatusRows.filter(w => w.status === 'pending').length,
      rejected:  workStatusRows.filter(w => w.status === 'rejected').length,
      deleted:   workStatusRows.filter(w => w.status === 'deleted').length,
      total:     workStatusRows.length,
    };

    // ── Projekt-Statistik: Anträge (impact_applications) + laufende Projekte (impact_projects) ──
    const appStatusRows = projectApplicationsRes.data ?? [];
    const liveProjects = impactProjectsRes.data ?? [];
    // WICHTIG: 'impact_projects.votes' ist ein denormalisiertes Feld ohne Trigger/RPC,
    // das die App aktuell NICHT beschreibt (Alt-Code 'increment_project_votes' ist
    // unerreichbar/verwaist). Single Source of Truth fuer Stimmen ist 'impact_votes'.
    // Deshalb hier live aus 'impact_votes' zaehlen statt der toten Spalte zu vertrauen.
    const { count: realVoteCount } = await sb.from('impact_votes').select('*', { count: 'exact', head: true });
    const projectStats = {
      applicationsPending:  appStatusRows.filter(a => a.status === 'pending' || a.status === 'pending_review').length,
      applicationsApproved: appStatusRows.filter(a => a.status === 'approved').length,
      applicationsRejected: appStatusRows.filter(a => a.status === 'rejected').length,
      liveCount:            liveProjects.length,
      totalVotes:           realVoteCount ?? 0,
      totalAwardedEur:      liveProjects.reduce((s, p) => s + (p.awarded_eur ?? 0), 0),
    };

    // ══════════════════════════════════════════════════════════════════════
    // ── 8 Kuchendiagramme — ARCH-006.1, alle live aus Supabase, keine Fakes ──
    // ══════════════════════════════════════════════════════════════════════

    // 1) User-Zusammensetzung
    const adminCountPie    = profiles.filter(p => ['admin','superadmin'].includes(p.role)).length;
    const basisCountPie    = Math.max(profiles.length - activeWirker - activeMembers - adminCountPie, 0);
    const userComposition  = { wirker: activeWirker, member: activeMembers, admin: adminCountPie, basisuser: basisCountPie };

    // 2) Mitgliedschafts-Typen
    const membershipTypes = { basisuser: 0, talent: 0, member: 0 } as Record<string, number>;
    profiles.forEach(p => { if (p.membership_type && p.membership_type in membershipTypes) membershipTypes[p.membership_type]++; });

    // 3) Top Städte
    const cityMap: Record<string, number> = {};
    profiles.forEach(p => { if (p.location_label) cityMap[p.location_label] = (cityMap[p.location_label] ?? 0) + 1; });
    const topCities = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count }));

    // 4) Buchungs-Verteilung nach Typ
    const bookingTypeRows = bookingTypesRes.data ?? [];
    const bookingDistribution = {
      work:    bookingTypeRows.filter(b => b.booking_type === 'work').length,
      talent:  bookingTypeRows.filter(b => b.booking_type === 'talent').length,
      project: bookingTypeRows.filter(b => b.booking_type === 'project').length,
    };

    // 5) Kauf-Verteilung + 6) Impact-Verteilung + 8) Zahlungs-Verteilung — alle aus stripe_payments
    const allPayments = allPaymentsRes.data ?? [];
    const succeededPayments = allPayments.filter(p => p.status === 'succeeded');
    const purchaseDistribution = {
      work:         succeededPayments.filter(p => p.payment_type === 'work').length,
      talent:       succeededPayments.filter(p => p.payment_type === 'talent').length,
      project:      succeededPayments.filter(p => p.payment_type === 'impact_pool').length,
      donation:     succeededPayments.filter(p => p.payment_type === 'donation').length,
      subscription: succeededPayments.filter(p => p.payment_type === 'subscription').length,
    };
    const sumShare = (rows: typeof allPayments) => rows.reduce((s, p) => s + ((p.impact_pool_share ?? 0) / 100), 0);
    const impactDistribution = {
      work:     sumShare(succeededPayments.filter(p => p.payment_type === 'work')),
      talent:   sumShare(succeededPayments.filter(p => p.payment_type === 'talent')),
      project:  sumShare(succeededPayments.filter(p => p.payment_type === 'impact_pool')),
      donation: sumShare(succeededPayments.filter(p => p.payment_type === 'donation')),
    };
    const paymentStatusDistribution = {
      succeeded: allPayments.filter(p => p.status === 'succeeded').length,
      pending:   allPayments.filter(p => p.status === 'pending').length,
      failed:    allPayments.filter(p => p.status === 'failed').length,
      refunded:  allPayments.filter(p => p.status === 'refunded' || p.status === 'partially_refunded').length,
    };

    // 7) Ambassador-Tier-Verteilung — je Ambassador der jeweils aktuellste (neueste) Tier-Stand
    const latestTierByAmbassador = new Map<string, string>();
    (ambassadorCommissionsRes.data ?? []).forEach(row => {
      if (!latestTierByAmbassador.has(row.ambassador_id) && row.tier) latestTierByAmbassador.set(row.ambassador_id, row.tier);
    });
    const ambassadorTiers = { bronze: 0, silber: 0, gold: 0, platin: 0 } as Record<string, number>;
    latestTierByAmbassador.forEach(tier => { if (tier in ambassadorTiers) ambassadorTiers[tier]++; });

    // Impact Pool: live aus stripe_impact_pool (aktueller Monat) — keine lokale Berechnung
    // ADMIN-DASH-FIX (2026-07-04): stripe_impact_pool hat SEIT dem Entfernen des
    // fehlerhaften UNIQUE(month)-Constraints korrekterweise EINE ZEILE PRO BESTELLUNG
    // (nicht mehr eine pro Monat) -- .maybeSingle() wirft jetzt PGRST116 ("contains N
    // rows"), sobald mehr als 1 Bestellung im Monat existiert. Fix: alle Zeilen des
    // Monats laden und summieren (gleiches Muster wie sumAmt() fuer bookingStats oben).
    const currentPoolMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { data: poolRows } = await sb
      .from('stripe_impact_pool')
      .select('total_inflow, project_share, company_share')
      .eq('month', currentPoolMonth);
    const sumPool = (field: 'total_inflow' | 'project_share' | 'company_share') =>
      (poolRows ?? []).reduce((s, r) => s + (r[field] ?? 0), 0);
    const impactPool      = sumPool('total_inflow')  / 100; // Brutto-Pool (15% vom Umsatz)
    const projectShareEur = sumPool('project_share') / 100; // 15% davon → Projekte
    const companyShareEur = sumPool('company_share') / 100; // 85% davon → Firma

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
        activeBookings:  activeBookingsCount,
        activeAmbassadors,
        pendingAmbassadors,
        totalReferrals,
      },
      recentUsers:    recentUsersRes.data ?? [],
      recentPayments: recentPaymentsMapped,
      impactProjects: impactProjectsRes.data ?? [],
      growth: {
        labels:      months.map(m => m.label),
        newUsers:    newUsersPerMonth,
        activeUsers: cumulativeUsers,
      },
      bookingStats,
      talentStats,
      workStats,
      projectStats,
      pieData: {
        userComposition,
        membershipTypes,
        topCities,
        bookingDistribution,
        purchaseDistribution,
        impactDistribution,
        ambassadorTiers,
        paymentStatusDistribution,
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dashboard GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
