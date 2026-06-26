// frontend/src/app/api/dashboard/route.ts
// GET /api/dashboard — alle KPI-Daten in einem Call, service_role
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const sb = getServiceClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  try {
    // Alle Queries parallel
    const [
      profilesRes,
      worksRes,
      paymentsMonthRes,
      paymentsAllRes,
      impactProjectsRes,
      ambassadorsRes,
      recentUsersRes,
      growthRes,
    ] = await Promise.all([
      // 1) Alle Profile
      sb.from('profiles')
        .select('id, is_wirker, role, is_member, membership_active, is_ambassador, created_at, blocked', { count: 'exact' })
        .limit(5000),

      // 2) Werke (published)
      sb.from('works').select('id', { count: 'exact' }).eq('status', 'published'),

      // 3) Payments diesen Monat
      sb.from('payments')
        .select('id, amount_eur, status, created_at')
        .eq('status', 'completed')
        .gte('created_at', startOfMonth)
        .limit(5000),

      // 4) Alle Payments total
      sb.from('payments').select('id', { count: 'exact' }),

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
        .select('id, display_name, username, email, role, is_wirker, created_at, avatar_url')
        .order('created_at', { ascending: false })
        .limit(8),

      // 8) Growth: User pro Monat (letzte 12)
      sb.from('profiles')
        .select('created_at')
        .gte('created_at', new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString())
        .limit(5000),
    ]);

    const profiles      = profilesRes.data ?? [];
    const totalUsers    = profilesRes.count ?? profiles.length;
    const activeWirker  = profiles.filter(p => p.is_wirker).length;
    const activeMembers = profiles.filter(p => p.is_member || p.membership_active).length;

    const monthlyRevenue = (paymentsMonthRes.data ?? []).reduce((s, p) => s + (p.amount_eur ?? 0), 0);
    const impactPool     = monthlyRevenue * 0.15;
    const totalPayments  = paymentsAllRes.count ?? 0;

    const activeAmbassadors  = ambassadorsRes.count ?? 0;

    // Growth Chart — User gruppiert nach Monat
    const growthData = growthRes.data ?? [];
    const months: { label: string; start: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString('de-DE', { month: 'short' }),
        start: d,
      });
    }
    const newUsers = months.map(({ start }, idx) => {
      const end = idx < months.length - 1 ? months[idx + 1].start : new Date();
      return growthData.filter(p => {
        const d = new Date(p.created_at);
        return d >= start && d < end;
      }).length;
    });
    const activeUsers = newUsers.map((_, i) => newUsers.slice(0, i + 1).reduce((s, v) => s + v, 0));

    // Recent payments (letzte 8)
    const recentPaymentsRes = await sb.from('payments')
      .select('id, amount_eur, status, created_at')
      .order('created_at', { ascending: false })
      .limit(8);

    return NextResponse.json({
      kpis: {
        totalUsers,
        activeWirker,
        activeMembers,
        totalWorks:     worksRes.count ?? 0,
        monthlyRevenue,
        impactPool,
        totalPayments,
        activeBookings: 0,
        activeAmbassadors,
        pendingAmbassadors: 0,
        totalReferrals: 0,
      },
      recentUsers:    recentUsersRes.data ?? [],
      recentPayments: recentPaymentsRes.data ?? [],
      impactProjects: impactProjectsRes.data ?? [],
      growth: {
        labels:      months.map(m => m.label),
        newUsers,
        activeUsers,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
