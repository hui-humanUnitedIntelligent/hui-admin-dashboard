// frontend/src/app/api/startphase/applications/route.ts
// HUI Startphase — Bewerbungen abrufen (Admin only)
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';
import { ok, fail, serverError } from '@/app/lib/api-response';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('search') || '';

    const sb = getServiceClient();

    let q = sb.from('startphase_applications')
      .select('*', { count: 'exact' });

    // Filter
    if (filter !== 'all') {
      const statusMap: Record<string, string> = {
        'new': 'new',
        'review': 'review',
        'question': 'question',
        'accepted': 'accepted',
        'rejected': 'rejected',
        'completed': 'completed',
      };
      if (statusMap[filter]) {
        q = q.eq('status', statusMap[filter]);
      }
    }

    // Suche nach Name oder E-Mail
    if (search) {
      q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, count, error } = await q;

    if (error) return fail(error.message, 500);

    // Stats holen
    const { data: statsData } = await sb.from('startphase_applications')
      .select('status')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        return { data, error: null };
      }) as { data: { status: string }[] | null, error: null };

    const stats = {
      new: 0, review: 0, question: 0, accepted: 0, rejected: 0, completed: 0, total: 0,
    };
    if (statsData) {
      for (const row of statsData) {
        if (row.status in stats) (stats as any)[row.status]++;
        stats.total++;
      }
    }

    return ok({ applications: data ?? [], stats, total: count ?? 0 });
  } catch (err) {
    return serverError(err, 'startphase-applications');
  }
}
