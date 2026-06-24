// frontend/src/app/api/experiences/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

const SELECT_FIELDS = 'id,user_id,title,category,description,price,status,approval_status,rejection_reason,is_update,admin_comment,sensitivity_status,sensitivity_reason,cover_url,images,location_text,format,duration,date,time_start,time_end,experience_type,max_participants,created_at,updated_at,last_submitted_at';

async function fetchTable(table: string, status: string | null, limit: number) {
  const supabase = getServiceClient();
  let query = supabase.from(table).select(SELECT_FIELDS).order('created_at', { ascending: false }).limit(limit);

  if (status && status !== 'all') {
    if (status === 'pending') {
      query = query.or('approval_status.eq.pending,status.eq.pending_review');
    } else if (status === 'approved') {
      query = query.eq('approval_status', 'approved');
    } else if (status === 'rejected') {
      query = query.or('approval_status.eq.rejected,status.eq.rejected');
    } else {
      query = query.eq('status', status);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(r => ({
    ...r,
    _source: table,
    approval_status: r.approval_status
      ?? (r.status === 'pending_review' ? 'pending'
        : r.status === 'published'    ? 'approved'
        : r.status === 'rejected'     ? 'rejected'
        : r.status === 'draft'        ? 'draft'
        : null),
  }));
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit  = Math.min(parseInt(searchParams.get('limit') || '500', 10), 2000);

    const [experiences, projects] = await Promise.all([
      fetchTable('experiences', status, limit),
      fetchTable('impact_projects', status, limit),
    ]);

    const combined = [...experiences, ...projects].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return ok({ items: combined, total: combined.length });
  } catch (err) {
    return serverError(err, 'experiences GET');
  }
}
