// frontend/src/app/api/pending-counts/route.ts
// BADGE-SYNC-002: Doppelte Status-Prüfung für experiences (status + approval_status)
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const WORKS_PENDING   = ['pending_review', 'submitted', 'pending', 'review', 'waiting_for_approval'];
const TALENTS_PENDING = ['pending', 'pending_review'];

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();

  const [worksRes, talentsRes, expByStatus, expByApproval] = await Promise.all([
    // Works: status-Spalte
    sb.from('works')
      .select('id', { count: 'exact', head: true })
      .in('status', WORKS_PENDING),
    // Talents: status-Spalte
    sb.from('talents')
      .select('id', { count: 'exact', head: true })
      .in('status', TALENTS_PENDING),
    // Experiences: status-Spalte (pending_review)
    sb.from('experiences')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending_review', 'pending', 'submitted']),
    // Experiences: approval_status-Spalte (pending) — zweiter Pfad
    sb.from('experiences')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending'),
  ]);

  const works       = worksRes.count   ?? 0;
  const talents     = talentsRes.count ?? 0;
  // Nimm das Maximum — welcher Pfad auch immer den richtigen Status hat
  const experiences = Math.max(expByStatus.count ?? 0, expByApproval.count ?? 0);

  return NextResponse.json({
    works,
    talents,
    experiences,
    total: works + talents + experiences,
  });
}
