// frontend/src/app/api/pending-counts/route.ts
import { NextResponse } from 'next/server';
import { guardEmployee } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const SUBMITTED = ['submitted', 'pending', 'pending_review', 'review', 'waiting_for_approval'];

export async function GET(req: Request) {
  const guard = await guardEmployee(req as any);
  if (guard) return guard;

  const sb = getServiceClient();

  const [worksRes, talentsRes, expRes] = await Promise.all([
    sb.from('works').select('id', { count: 'exact', head: true }).in('status', SUBMITTED),
    sb.from('talents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('experiences').select('id', { count: 'exact', head: true }).in('status', SUBMITTED),
  ]);

  return NextResponse.json({
    works:       worksRes.count   ?? 0,
    talents:     talentsRes.count ?? 0,
    experiences: expRes.count     ?? 0,
    total: (worksRes.count ?? 0) + (talentsRes.count ?? 0) + (expRes.count ?? 0),
  });
}
