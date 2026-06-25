// frontend/src/app/api/works/route.ts
// GET /api/works — Alle Werke via Service Role (bypasses RLS)
// Echte DB-Status: pending_review | published | rejected | deleted
// ?status=pending_review|published|rejected|deleted → exakter Filter
// kein status / status=all → alle laden
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
      .from('works')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(skip, skip + limit - 1);

    // Nur filtern bei explizitem Status-Parameter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    // Kein Filter → alle Werke (pending_review, published, rejected, deleted)

    const { data, error, count } = await query;
    if (error) throw error;

    return ok({ works: data ?? [], total: count ?? 0 });
  } catch (err) {
    return serverError(err, 'works GET');
  }
}
