// frontend/src/app/api/impact/route.ts
// Impact Pool — Stripe-ready: alle Zahlen kommen aus payments-Tabelle (15% von amount_eur)
import { NextRequest, NextResponse } from 'next/server';
import { guardEmployee, guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const IMPACT_RATE    = 0.15; // 15% des Umsatzes → Brutto-Impact-Pool
const NETTO_RATE     = 0.85; // 85% davon → Netto-Impact (Projekte)
const FIRMA_RATE     = 0.15; // 15% davon → Firmenanteil (Systemkosten)

export async function GET(req: NextRequest) {
  const guard = await guardEmployee(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const type   = searchParams.get('type')   || 'overview';
    const status = searchParams.get('status') || 'all';
    const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sb     = getServiceClient();

    // ── Pool-Finanzdaten: einzige Quelle ist Stripe (ARCH-006.1) ──────────
    if (type === 'pool' || type === 'overview') {
      // Gesamtumsatz + Aufschlüsselung nach Zahlungstyp aus rpc_get_stripe_overview
      const { data: ov } = await sb.rpc('rpc_get_stripe_overview');
      const byType: Record<string, { count: number; total_eur: number }> = ov?.by_type ?? {};
      const revenueByType = {
        work:                 byType.work?.total_eur ?? 0,
        talent:               byType.talent?.total_eur ?? 0,
        donation:             byType.donation?.total_eur ?? 0,
        subscription:         byType.subscription?.total_eur ?? 0,
        impact_subscription:  byType.impact_subscription?.total_eur ?? 0,
      };
      const totalRevenue = ov?.total_volume_eur ?? 0;
      const paymentCount = ov?.total_payments ?? 0;

      // Impact-Pool-Zahlen: alle Monate aus stripe_impact_pool aufsummieren
      const { data: poolRows } = await sb
        .from('stripe_impact_pool')
        .select('month,total_inflow,project_share,company_share,distributed')
        .order('month', { ascending: false });

      const rows = poolRows ?? [];
      const bruttoPool   = rows.reduce((s, r) => s + (r.total_inflow   ?? 0), 0) / 100;
      const nettoImpact  = rows.reduce((s, r) => s + (r.project_share  ?? 0), 0) / 100;
      const firmenanteil = rows.reduce((s, r) => s + (r.company_share  ?? 0), 0) / 100;
      const distributed  = rows.filter(r => r.distributed)
        .reduce((s, r) => s + (r.project_share ?? 0), 0) / 100;
      const latestPool   = rows[0] ?? null;

      // Bewerbungen zählen
      const { count: appTotal } = await sb
        .from('impact_applications')
        .select('*', { count: 'exact', head: true });
      const { count: appApproved } = await sb
        .from('impact_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      const { count: appPending } = await sb
        .from('impact_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'submitted');

      // Monatliche Aufschlüsselung direkt aus stripe_impact_pool (letzte 6 Monate)
      const monthly = rows.slice(0, 6).map(r => ({
        month:   r.month,
        revenue: (r.total_inflow ?? 0) / 100 / IMPACT_RATE,
        impact:  (r.total_inflow ?? 0) / 100,
        count:   0,
      }));

      return NextResponse.json({
        ok: true,
        // Finanzen (Single Source of Truth: stripe_payments / stripe_impact_pool)
        totalRevenue,
        bruttoPool,
        nettoImpact,
        firmenanteil,
        distributed,
        openImpact:    nettoImpact - distributed,
        // Quellen
        revenueByType,
        paymentCount,
        // Bewerbungen
        applications:  { total: appTotal ?? 0, approved: appApproved ?? 0, pending: appPending ?? 0 },
        // Pool-Status
        poolState:     latestPool?.distributed ? 'distributed' : 'accumulating',
        poolMonth:     latestPool?.month ?? null,
        monthly,
        // Stripe-Status — live, da vollständig integriert
        stripeReady:   true,
      });
    }

    // ── Bewerbungen ───────────────────────────────────────────────────────
    if (type === 'applications') {
      let q = sb.from('impact_applications')
        .select('id,user_id,project_name,short_desc,problem,vision,funding_goal,contact_name,contact_email,location,status,submitted_at,reviewed_at,created_at,admin_comment,rejection_reason', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (status !== 'all') q = q.eq('status', status);
      const { data, count } = await q.range(offset, offset + limit - 1);
      const uids = [...new Set((data ?? []).map((a: {user_id: string}) => a.user_id).filter(Boolean))];
      const { data: profs } = uids.length
        ? await sb.from('profiles').select('id,display_name,username,avatar_url').in('id', uids)
        : { data: [] };
      const pm = new Map((profs ?? []).map((p: {id:string;display_name:string;username:string;avatar_url:string}) => [p.id, p]));
      const enriched = (data ?? []).map((a: Record<string, unknown>) => ({
        ...a,
        applicant: pm.get(a.user_id as string) ?? null,
      }));
      return NextResponse.json({ applications: enriched, total: count ?? 0 });
    }

    // ── Zahlungshistorie (Stripe-ready) ───────────────────────────────────
    if (type === 'payments') {
      const { data, count } = await sb
        .from('payments')
        .select('id,amount_eur,impact_eur,item_type,item_name,status,payment_status,paid_at,created_at,stripe_session_id,user_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      const total_impact = ((data ?? []) as {amount_eur?: number; status?: string}[])
        .filter(p => ['completed','paid','released'].includes(p.status ?? ''))
        .reduce((s, p) => s + (p.amount_eur ?? 0) * IMPACT_RATE, 0);
      return NextResponse.json({ payments: data ?? [], total: count ?? 0, total_impact });
    }

    return NextResponse.json({ ok: false, error: 'Unbekannter type-Parameter' }, { status: 400 });

  } catch (err) {
    console.error('[impact GET]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── Bewerbung genehmigen / ablehnen ──────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { id, action, admin_comment, rejection_reason } = await req.json();
    if (!id || !action) return NextResponse.json({ ok: false, error: 'id + action erforderlich' }, { status: 400 });
    const sb  = getServiceClient();
    const now = new Date().toISOString();
    let updates: Record<string, unknown> = { updated_at: now };

    if (action === 'approve') {
      updates = { ...updates, status: 'approved', reviewed_at: now, admin_comment: admin_comment ?? null };
    } else if (action === 'reject') {
      updates = { ...updates, status: 'rejected', reviewed_at: now, rejection_reason: rejection_reason ?? null };
    } else {
      return NextResponse.json({ ok: false, error: `Unbekannte Aktion: ${action}` }, { status: 400 });
    }

    const { error } = await sb.from('impact_applications').update(updates).eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id, action });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
