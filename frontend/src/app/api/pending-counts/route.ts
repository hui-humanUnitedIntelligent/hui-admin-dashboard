// frontend/src/app/api/pending-counts/route.ts
// BADGE-SYNC-004: + Impact Projekte (impact_applications) + Ablehnungsgründe (impact_score_failures)
// BADGE-SYNC-005 (2026-08-22): + Fehlermeldungen (bug_reports, status='offen')
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();

  // FIX (2026-08-21, BADGE-GHOST-001): head:true + count:'exact' liefert auf
  // Vercel veraltete/wrong counts (Supabase JS Client HEAD-Count-Bug). Statt
  // head:true jetzt echtes Data-Fetch + .length — für kleine Admin-Counts
  // (0-50 Records) vernachlässigbar, aber KORREKT.
  const [
    worksRes, talentsRes, expRes, momentesRes, recReportsRes,
    impactAppsRes, scoreFailuresRes, bugReportsRes,
  ] = await Promise.all([
    // Works: warten auf Freigabe
    sb.from('works')
      .select('id')
      .in('status', ['pending_review', 'submitted', 'pending', 'review', 'waiting_for_approval']),

    // Talents: warten auf Freigabe
    sb.from('talents')
      .select('id')
      .in('status', ['pending', 'pending_review']),

    // Experiences: NUR wenn status=pending_review
    sb.from('experiences')
      .select('id')
      .eq('status', 'pending_review'),

    // Momente: gemeldete Momente (distinct moment_id)
    sb.from('momente_reports')
      .select('moment_id'),

    // Recommendation Reports: neue Meldungen
    sb.from('recommendation_reports')
      .select('id')
      .eq('status', 'new'),

    // Impact Projekte: eingereichte Bewerbungen
    sb.from('impact_applications')
      .select('id')
      .in('status', ['submitted','pending','pending_review','review','waiting_for_approval']),

    // Ablehnungsgründe: KI-abgelehnte Einreichungen
    sb.from('impact_score_failures')
      .select('id'),

    // Fehlermeldungen: offene Bug-Reports (BADGE-SYNC-005)
    sb.from('bug_reports')
      .select('id')
      .eq('status', 'offen'),
  ]);

  const works              = worksRes.data?.length     ?? 0;
  const talents            = talentsRes.data?.length   ?? 0;
  const experiences        = expRes.data?.length       ?? 0;
  // momente_reports: zähle distinct moment_id
  const momente = new Set((momentesRes.data ?? []).map((r: any) => r.moment_id)).size;
  const recReports          = recReportsRes.data?.length  ?? 0;
  const impactApplications  = impactAppsRes.data?.length ?? 0;
  const scoreFailures       = scoreFailuresRes.data?.length ?? 0;
  const bugReports          = bugReportsRes.data?.length  ?? 0;

  const total = works + talents + experiences + momente + recReports + impactApplications + scoreFailures + bugReports;

  // CACHE-BUST-001 (2026-08-21): Vercel liefert veraltete Badge-Zähler.
  // Force no-store + immutable response um Edge-Caching zu verhindern.
  const res = NextResponse.json({
    works,
    talents,
    experiences,
    momente,
    recReports,
    impactApplications,
    scoreFailures,
    bugReports,
    total,
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
  return res;
}
