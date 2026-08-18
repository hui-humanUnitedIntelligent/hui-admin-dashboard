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

    // Momente: beitraege hat KEIN status-Feld — gemeldete Momente
    // werden über momente_reports getrackt. Zähle distinct moment_id
    // (ein Moment kann mehrfach gemeldet sein → Badge soll 1 sein, nicht 3).
    // postgREST head+count gibt die Anzahl der Rows, nicht distinct.
    // Daher: normale Query + Distinct im Code → siehe unten.
    sb.from('momente_reports')
      .select('moment_id'),

    // Recommendation Reports: neue Meldungen
    sb.from('recommendation_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),

    // Impact Projekte: eingereichte Herzensprojekt-Bewerbungen, noch nicht beschieden
    // (Status-Werte synchron mit impact-applications/route.ts SUBMITTED-Array)
    sb.from('impact_applications')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted','pending','pending_review','review','waiting_for_approval']),

    // Ablehnungsgründe: KI-abgelehnte Projekt-Einreichungen, noch nicht vom Admin gesichtet/geloescht
    sb.from('impact_score_failures')
      .select('id', { count: 'exact', head: true }),
  ]);

  const works              = worksRes.count         ?? 0;
  const talents            = talentsRes.count       ?? 0;
  const experiences        = expRes.count           ?? 0;
  // momente_reports gibt uns rows mit moment_id — zähle distinct
  const momente = new Set((momentesRes.data ?? []).map((r: any) => r.moment_id)).size;
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
