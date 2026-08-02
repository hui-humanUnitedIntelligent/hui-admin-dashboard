// frontend/src/app/api/pending-counts/route.ts
// BADGE-SYNC-003: Korrekte Pending-Logik für experiences + recommendation_reports
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();

  const [worksRes, talentsRes, expRes, momentesRes, recReportsRes] = await Promise.all([
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
  ]);

  const works       = worksRes.count    ?? 0;
  const talents     = talentsRes.count  ?? 0;
  const experiences = expRes.count      ?? 0;
  const momente     = momentesRes.count ?? 0;
  const recReports  = recReportsRes.count ?? 0;

  const total = works + talents + experiences + momente + recReports;

  return NextResponse.json({
    works,
    talents,
    experiences,
    momente,
    recReports,
    total,
  });
}
