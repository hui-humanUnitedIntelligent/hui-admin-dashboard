// frontend/src/app/api/pending-counts/route.ts
// BADGE-SYNC-001: Einheitliche Zähler für alle Content-Bereiche
// Zählt alle Einträge die auf Freigabe warten (pending_review / pending)
// → Basis für Badge-Anzeige in der SADB-Navigation
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

// Alle möglichen "warten auf Freigabe" Status-Werte (unions über alle Tabellen)
const WORKS_PENDING    = ['pending_review', 'submitted', 'pending', 'review', 'waiting_for_approval'];
const TALENTS_PENDING  = ['pending', 'pending_review'];        // talents-Tabelle nutzt 'pending'
const EXP_PENDING      = ['pending_review', 'submitted', 'pending', 'review', 'waiting_for_approval'];

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();

  const [worksRes, talentsRes, expRes] = await Promise.all([
    sb.from('works')
      .select('id', { count: 'exact', head: true })
      .in('status', WORKS_PENDING),
    sb.from('talents')
      .select('id', { count: 'exact', head: true })
      .in('status', TALENTS_PENDING),
    sb.from('experiences')
      .select('id', { count: 'exact', head: true })
      .in('status', EXP_PENDING),
  ]);

  const works       = worksRes.count   ?? 0;
  const talents     = talentsRes.count ?? 0;
  const experiences = expRes.count     ?? 0;

  return NextResponse.json({
    works,
    talents,
    experiences,
    total: works + talents + experiences,
  });
}
