// frontend/src/app/api/impact/route.ts
// Impact Pool — Stripe-ready: alle Zahlen kommen aus payments-Tabelle (Balanced Growth v1: 6% Impact vom Bruttoumsatz)
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const IMPACT_RATE    = 0.06; // Balanced Growth v1: 6% des Umsatzes → Impact-Pool (30% von 20% HUI)
const NETTO_RATE     = 0.70; // Balanced Growth v1: 70% des Impact-Pools → Projekte
const FIRMA_RATE     = 0.50; // Balanced Growth v1: 50% von HUI = Unternehmensanteil (10% Brutto)

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
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
        .select('month,total_inflow,project_share,company_share,distributed,projekte_foerdern_eur,hui_weiterentwickeln_eur,neue_ideen_eur,qualitaet_sichern_eur,impact_pool_eur,impact_projects_eur,impact_flex_pool_eur,hui_company_eur,innovation_fund_eur')
        .order('month', { ascending: false });

      const rows = poolRows ?? [];
      // SSOT: impact_pool_eur = tatsächlicher Impact-Anteil (6% des Umsatzes) in EUR
      // NICHT total_inflow/100 (das wäre der Gesamtumsatz!)
      const bruttoPool   = rows.reduce((s, r) => s + (Number((r as Record<string,unknown>)['impact_pool_eur']) || 0), 0);
      // impact_projects_eur = 70% von Impact-Pool → an Projekte ausgeschüttet
      const nettoImpact  = rows.reduce((s, r) => s + (Number((r as Record<string,unknown>)['impact_projects_eur']) || Number(r.projekte_foerdern_eur) || 0), 0);
      // hui_company_eur = 50% von HUI-Anteil (10% Brutto)
      const firmenanteil = rows.reduce((s, r) => s + (Number((r as Record<string,unknown>)['hui_company_eur']) || (r.company_share ?? 0) / 100), 0);
      const distributed  = rows.filter(r => r.distributed)
        .reduce((s, r) => s + (Number((r as Record<string,unknown>)['impact_projects_eur']) || Number(r.projekte_foerdern_eur) || 0), 0);
      // flexPool = 30% des Impact-Pools (= 1,8% vom Umsatz) → Rücklage/Reserve, NICHT an Projekte verteilt
      const flexPool     = rows.reduce((s, r) => s + (Number((r as Record<string,unknown>)['impact_flex_pool_eur']) || 0), 0);
      // innovationFund = 20% des HUI-Anteils (= 4% vom Umsatz) → Innovationsfonds für Weiterentwicklung
      const innovationFund = rows.reduce((s, r) => s + (Number((r as Record<string,unknown>)['innovation_fund_eur']) || 0), 0);
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
      // SSOT: impact_pool_eur = tatsächlicher Monat-Impact-Pool; total_inflow/100 = Monat-Umsatz
      const monthly = rows.slice(0, 6).map(r => ({
        month:   r.month,
        revenue: (r.total_inflow ?? 0) / 100, // Bruttoumsatz des Monats (korrekt für Kontext)
        impact:  Number((r as Record<string,unknown>)['impact_pool_eur']) || (r.total_inflow ?? 0) / 100 * IMPACT_RATE,
        count:   0,
      }));

      return NextResponse.json({
        ok: true,
        // Finanzen (Single Source of Truth: stripe_payments / stripe_impact_pool)
        // Balanced Growth v1: Umsatz 100% -> Talent/Verkaeufer 80% + HUI 20%.
        // HUI-20%-Anteil splittet in Unternehmen 10% (firmenanteil) + Impact-Pool 6% (bruttoPool) + Innovationsfonds 4% (innovationFund).
        // Impact-Pool 6% splittet weiter in Projekte 4,2% (nettoImpact) + Flex-Ruecklage 1,8% (flexPool).
        totalRevenue,
        bruttoPool,
        nettoImpact,
        firmenanteil,
        innovationFund,
        flexPool,
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
        // Legacy-Hinweis: Liest aus alter Tabelle 'payments' (nie befuellt, kein SSOT-Mapping, SYS-LegacyMark-024). Zeigt korrekt leer/0.
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
