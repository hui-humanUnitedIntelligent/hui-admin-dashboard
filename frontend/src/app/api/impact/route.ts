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

    // ── Pool-Finanzdaten direkt aus payments berechnen ────────────────────
    if (type === 'pool' || type === 'overview') {
      // Alle abgeschlossenen Zahlungen (status = completed/paid)
      const { data: payments } = await sb
        .from('payments')
        .select('id,amount_eur,impact_eur,item_type,status,payment_status,paid_at,created_at,user_id,wirker_id,item_name')
        .in('status', ['completed', 'paid', 'released'])
        .order('created_at', { ascending: false });

      const paidPayments = payments ?? [];

      // Umsatz nach Typ aufschlüsseln
      const revenueByType: Record<string, number> = { works: 0, experiences: 0, bookings: 0, other: 0 };
      let totalRevenue = 0;
      for (const p of paidPayments) {
        const amt = p.amount_eur ?? 0;
        totalRevenue += amt;
        const t = (p.item_type || 'other').toLowerCase();
        if (t.includes('work'))       revenueByType.works       += amt;
        else if (t.includes('exp') || t.includes('erlebnis')) revenueByType.experiences += amt;
        else if (t.includes('book')) revenueByType.bookings     += amt;
        else                         revenueByType.other        += amt;
      }

      // Impact-Pool-Berechnungen
      const bruttoPool    = totalRevenue * IMPACT_RATE;       // 15% vom Umsatz
      const nettoImpact   = bruttoPool   * NETTO_RATE;        // 85% davon = Projekte
      const firmenanteil  = bruttoPool   * FIRMA_RATE;        // 15% davon = System

      // Bereits vergebene Beträge aus impact_pool-Tabelle
      const { data: poolRows } = await sb
        .from('impact_pool')
        .select('*')
        .order('month', { ascending: false });

      const distributed = (poolRows ?? []).reduce((s: number, p: {distributed_eur?: number}) => s + (p.distributed_eur ?? 0), 0);
      const latestPool  = (poolRows ?? [])[0] ?? null;

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

      // Monatliche Aufschlüsselung (letzte 6 Monate)
      const monthlyMap: Record<string, {revenue: number; impact: number; count: number}> = {};
      for (const p of paidPayments) {
        const mo = (p.paid_at || p.created_at || '').slice(0, 7); // YYYY-MM
        if (!mo) continue;
        if (!monthlyMap[mo]) monthlyMap[mo] = { revenue: 0, impact: 0, count: 0 };
        monthlyMap[mo].revenue += p.amount_eur ?? 0;
        monthlyMap[mo].impact  += (p.amount_eur ?? 0) * IMPACT_RATE;
        monthlyMap[mo].count   += 1;
      }
      const monthly = Object.entries(monthlyMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 6)
        .map(([month, d]) => ({ month, ...d }));

      return NextResponse.json({
        ok: true,
        // Finanzen
        totalRevenue,
        bruttoPool,
        nettoImpact,
        firmenanteil,
        distributed,
        openImpact:    nettoImpact - distributed,
        // Quellen
        revenueByType,
        paymentCount:  paidPayments.length,
        // Bewerbungen
        applications:  { total: appTotal ?? 0, approved: appApproved ?? 0, pending: appPending ?? 0 },
        // Pool-Status
        poolState:     latestPool?.state ?? 'accumulating',
        poolMonth:     latestPool?.month ?? null,
        monthly,
        // Stripe-Status
        stripeReady:   false, // wird auf true gesetzt sobald Stripe eingebunden ist
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
