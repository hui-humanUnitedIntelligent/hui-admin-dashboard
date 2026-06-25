// frontend/src/app/api/experiences/route.ts
// GET /api/experiences — Erlebnisse (experiences-Tabelle)
// Echte DB-Status: pending_review | published
// Tabelle "projects" existiert NICHT — nur "impact_projects" (separat)
import { NextRequest } from 'next/server';
import { guardUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

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
      .from('experiences')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    // Nur filtern bei explizitem Status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Response als Array (Hook erwartet Array)
    return ok(data ?? []);
  } catch (err) {
    return serverError(err, 'experiences GET');
  }
}
