// frontend/src/app/api/works/route.ts
// GET /api/works — ALLE Werke via Service Role (bypasses RLS)
// Echte DB-Status: pending_review | published | rejected | deleted
// Response: { data: HuiWork[] } — immer dieses Format
import { NextRequest, NextResponse } from 'next/server';
import { guardUser } from '@/app/lib/auth-guard';
import { serverError } from '@/app/lib/api-response';
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

    // Nur bei explizitem Status filtern (nicht bei 'all' oder fehlendem Param)
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // IMMER { data: [...] } — Hook erwartet json.data als Array
    return NextResponse.json({ data: data ?? [], total: count ?? 0 });
  } catch (err) {
    return serverError(err, 'works GET');
  }
}
