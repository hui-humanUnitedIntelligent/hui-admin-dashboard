// frontend/src/app/api/pending-counts/route.ts
// BADGE-SYNC-004: + Impact Projekte (impact_applications) + Ablehnungsgründe (impact_score_failures)
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();

  const [
    worksRes, talentsRes, expRes, momentesRes, recReportsRes,
    impactAppsRes, scoreFailuresRes,
  ] = await Promise.all([
    // Works: warten auf Freigabe
    sb.from('works')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending_review', 'submitted', 'pending', 'review', 'waiting_for_approval']),

    // Talents: warten auf Freigabe
    sb.from('talents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'pending_review']),

    // Experiences: NUR wenn status=pending_review
    sb.from('experiences')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review'),

    // Momente: gemeldete (status=reported) → brauchen Admin-Aufmerksamkeit
    sb.from('beitraege')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'reported'),

    // Recommendation Reports: neue Meldungen
    sb.from('recommendation_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),

    // Impact Projekte: eingereichte Herzensprojekt-Bewerbungen, noch nicht beschieden
    sb.from('impact_applications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted'),

    // Ablehnungsgründe: KI-abgelehnte Projekt-Einreichungen, noch nicht vom Admin gesichtet/geloescht
    sb.from('impact_score_failures')
      .select('id', { count: 'exact', head: true }),
  ]);

  const works              = worksRes.count         ?? 0;
  const talents            = talentsRes.count       ?? 0;
  const experiences        = expRes.count           ?? 0;
  const momente             = momentesRes.count      ?? 0;
  const recReports          = recReportsRes.count    ?? 0;
  const impactApplications  = impactAppsRes.count    ?? 0;
  const scoreFailures       = scoreFailuresRes.count ?? 0;

  const total = works + talents + experiences + momente + recReports + impactApplications + scoreFailures;

  return NextResponse.json({
    works,
    talents,
    experiences,
    momente,
    recReports,
    impactApplications,
    scoreFailures,
    total,
  });
}
