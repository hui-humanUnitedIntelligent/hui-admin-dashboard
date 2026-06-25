// frontend/src/app/api/works/route.ts
// GET /api/works — ALLE Werke laden (kein Status-Filter by default)
// ?status=submitted → IN SUBMITTED_STATES
// ?status=deleted|flagged|published|... → exakter Filter
import { NextRequest } from 'next/server';
import { guardUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

const SUBMITTED_STATES = ['submitted','pending','pending_review','review','waiting_for_approval'];

export async function GET(req: NextRequest) {
  const guard = await guardUser(req);
  if (guard) return guard;

  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit  = Math.min(parseInt(searchParams.get('limit') || '1000', 10), 2000);
    const skip   = parseInt(searchParams.get('skip') || '0', 10);

    let query = supabase
      .from('works')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(skip, skip + limit - 1);

    // Nur filtern wenn explizit angefordert
    if (status && status !== 'all') {
      if (status === 'submitted') {
        query = query.in('status', SUBMITTED_STATES);
      } else if (status === 'not_deleted') {
        query = query.neq('status', 'deleted');
      } else {
        // Einzelner Status (deleted, flagged, published, rejected, draft)
        query = query.eq('status', status);
      }
    }
    // status === 'all' oder kein status → kein Filter, alle Werke

    const { data, error, count } = await query;
    if (error) throw error;

    return ok({ works: data ?? [], total: count ?? 0 });
  } catch (err) {
    return serverError(err, 'works GET');
  }
}
