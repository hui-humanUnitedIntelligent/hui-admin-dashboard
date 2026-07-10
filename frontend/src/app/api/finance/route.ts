import { NextResponse } from 'next/server';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = getServiceClient();

    const [poolRes, phaseRes, txRes] = await Promise.all([
      sb.from('stripe_impact_pool')
        .select('total_inflow, hui_company_eur, impact_pool_eur, innovation_fund_eur, impact_projects_eur, impact_flex_pool_eur, company_share')
        .order('created_at', { ascending: false })
        .limit(10000),
      sb.from('hui_finance_phases').select('phase, label').eq('is_active', true).single(),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('state', 'paid'),
    ]);

    const rows = (poolRes.data ?? []) as any[];
    const sum = (field: string) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);

    const total_volume_eur   = sum('total_inflow');
    const hui_total_eur      = sum('impact_pool_eur') + sum('hui_company_eur') + sum('innovation_fund_eur');
    const company_eur        = sum('hui_company_eur') || sum('company_share') * 0.50;
    const impact_eur         = sum('impact_pool_eur') || total_volume_eur * 0.06;
    const innovation_eur     = sum('innovation_fund_eur') || total_volume_eur * 0.04;
    const impact_projects_eur = sum('impact_projects_eur') || impact_eur * 0.70;
    const impact_flex_eur    = impact_eur - impact_projects_eur;
    const talent_total_eur   = total_volume_eur - hui_total_eur;

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
      phase_label: phaseRes.data?.label ?? 'Aufbau',
      tx_count: txRes.count ?? 0,
      model: 'balanced_growth_v1',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
