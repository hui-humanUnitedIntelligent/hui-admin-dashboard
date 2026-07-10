import { NextResponse } from 'next/server';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = getServiceClient();

    const [poolRes, phaseRes, txRes] = await Promise.all([
      sb.from('stripe_impact_pool')
        .select('total_inflow, hui_company_eur, impact_pool_eur, innovation_fund_eur, impact_projects_eur, impact_flex_pool_eur')
        .order('created_at', { ascending: false })
        .limit(10000),
      sb.from('hui_finance_phases').select('phase, label').eq('is_active', true).single(),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('state', 'paid'),
    ]);

    const rows = (poolRes.data ?? []) as any[];

    // total_inflow ist in Cent gespeichert → /100 für EUR
    const sumCent = (field: string) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0) / 100;
    const sumEur  = (field: string) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);

    const total_volume_eur = sumCent('total_inflow');

    // _eur Felder als Primärquelle — falls NULL/0, deterministisch aus total_inflow berechnen
    const company_eur_raw    = sumEur('hui_company_eur');
    const impact_eur_raw     = sumEur('impact_pool_eur');
    const innovation_eur_raw = sumEur('innovation_fund_eur');

    // Wenn alle _eur Felder 0 sind (z.B. RLS-Filter), Prozentsatz-Fallback
    const hasEurData = (company_eur_raw + impact_eur_raw + innovation_eur_raw) > 0;

    const company_eur    = hasEurData ? company_eur_raw    : total_volume_eur * 0.10;
    const impact_eur     = hasEurData ? impact_eur_raw     : total_volume_eur * 0.06;
    const innovation_eur = hasEurData ? innovation_eur_raw : total_volume_eur * 0.04;

    const hui_total_eur   = company_eur + impact_eur + innovation_eur;
    const talent_total_eur = total_volume_eur - hui_total_eur;

    const impact_projects_eur_raw = sumEur('impact_projects_eur');
    const impact_flex_eur_raw     = sumEur('impact_flex_pool_eur');
    const impact_projects_eur = impact_projects_eur_raw > 0 ? impact_projects_eur_raw : impact_eur * 0.70;
    const impact_flex_eur     = impact_flex_eur_raw     > 0 ? impact_flex_eur_raw     : impact_eur * 0.30;

    return NextResponse.json({
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
      model:        'balanced_growth_v1',
      data_source:  hasEurData ? 'db_eur_fields' : 'calculated_from_inflow',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
