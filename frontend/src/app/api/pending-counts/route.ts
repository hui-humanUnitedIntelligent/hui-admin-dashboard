// frontend/src/app/api/pending-counts/route.ts
// BADGE-SYNC-003: Korrekte Pending-Logik für experiences
// Nur zählen wenn status NICHT bereits published/rejected/deleted (=wirklich zu prüfen)
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();

  const [worksRes, talentsRes, expRes] = await Promise.all([
    // Works: warten auf Freigabe
    sb.from('works')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending_review', 'submitted', 'pending', 'review', 'waiting_for_approval']),

    // Talents: warten auf Freigabe
    sb.from('talents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'pending_review']),

    // Experiences: NUR wenn status=pending_review UND NICHT bereits published/rejected/deleted
    // Verhindert falsche Badge durch inkonsistente approval_status-Felder
    sb.from('experiences')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
  ]);

  const works       = worksRes.count ?? 0;
  const talents     = talentsRes.count ?? 0;
  const experiences = expRes.count ?? 0;

  return NextResponse.json({
    works,
    talents,
    experiences,
    total: works + talents + experiences,
  });
}
