import { NextRequest, NextResponse } from 'next/server';
import { guardSuperAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

// Balanced Growth v1 — Live-Finanzdaten fuer die /finance Seite.
// SSOT: stripe_impact_pool (identische Quelle wie /api/dashboard und /api/impact).
// force-dynamic + no-store: verhindert jegliches Caching (Edge/CDN/Function),
// damit hier garantiert der aktuelle DB-Stand angezeigt wird -- kein Vercel-Stale-Cache.
export const dynamic  = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const sb = getServiceClient();

    const [poolRes, phaseRes, txRes] = await Promise.all([
      sb.from('stripe_impact_pool')
        .select('total_inflow, hui_company_eur, impact_pool_eur, innovation_fund_eur, impact_projects_eur, impact_flex_pool_eur')
        .limit(10000),
      sb.from('hui_finance_phases').select('phase, label').eq('is_active', true).maybeSingle(),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('state', 'paid'),
    ]);

    const rows = (poolRes.data ?? []) as Record<string, number | null>[];

    // total_inflow ist in Cent gespeichert -> /100 fuer EUR
    const sumCent = (field: string) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0) / 100;
    const sumEur  = (field: string) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);

    const total_volume_eur = sumCent('total_inflow');

    const company_eur_raw    = sumEur('hui_company_eur');
    const impact_eur_raw     = sumEur('impact_pool_eur');
    const innovation_eur_raw = sumEur('innovation_fund_eur');
    const hasEurData = (company_eur_raw + impact_eur_raw + innovation_eur_raw) > 0;

    const company_eur    = hasEurData ? company_eur_raw    : total_volume_eur * 0.10;
    const impact_eur     = hasEurData ? impact_eur_raw     : total_volume_eur * 0.06;
    const innovation_eur = hasEurData ? innovation_eur_raw : total_volume_eur * 0.04;

    const hui_total_eur    = company_eur + impact_eur + innovation_eur;
    const talent_total_eur = total_volume_eur - hui_total_eur;

    const impact_projects_eur_raw = sumEur('impact_projects_eur');
    const impact_flex_eur_raw     = sumEur('impact_flex_pool_eur');
    const impact_projects_eur = impact_projects_eur_raw > 0 ? impact_projects_eur_raw : impact_eur * 0.70;
    const impact_flex_eur     = impact_flex_eur_raw     > 0 ? impact_flex_eur_raw     : impact_eur * 0.30;

    const res = NextResponse.json({
      total_volume_eur,
      talent_total_eur,
      hui_total_eur,
      company_eur,
      impact_eur,
      innovation_eur,
      impact_projects_eur,
      impact_flex_eur,
      active_phase: phaseRes.data?.phase ?? 'phase1',
      phase_label:  phaseRes.data?.label  ?? 'Aufbau',
      tx_count:     txRes.count ?? 0,
      row_count:    rows.length, // Debug: Anzahl gelesener stripe_impact_pool-Zeilen
      model:        'balanced_growth_v1',
      data_source:  hasEurData ? 'db_eur_fields' : 'calculated_from_inflow',
    });
    // Explizit jegliches Zwischenspeichern verbieten (Edge/CDN/Browser).
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
