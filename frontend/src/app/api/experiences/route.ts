// frontend/src/app/api/experiences/route.ts
// GET /api/experiences — Erlebnisse + Projekte kombiniert
// Status-Filter: submitted|pending → SUBMITTED_STATES, all → keine Filter, deleted → gelöscht
import { NextRequest } from 'next/server';
import { guardUser } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

const SUBMITTED_STATES = ['submitted','pending','pending_review','review','waiting_for_approval'];

const SELECT_FIELDS = 'id,user_id,title,category,description,price,status,approval_status,rejection_reason,is_update,admin_comment,sensitivity_status,sensitivity_reason,cover_url,images,location_text,format,duration,date,time_start,time_end,experience_type,max_participants,created_at,updated_at,last_submitted_at';

async function fetchTable(table: string, status: string | null, limit: number) {
  const supabase = getServiceClient();
  let query = supabase
    .from(table)
    .select(SELECT_FIELDS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    if (status === 'submitted' || status === 'pending_all') {
      // "Eingereicht" = alle pending-ähnlichen Status (status ODER approval_status)
      query = query.or(
        `status.in.(${SUBMITTED_STATES.join(',')}),approval_status.in.(${SUBMITTED_STATES.join(',')})`
      );
    } else if (status === 'approved') {
      query = query.or('approval_status.eq.approved,status.eq.published');
    } else if (status === 'rejected') {
      query = query.or('approval_status.eq.rejected,status.eq.rejected');
    } else if (status === 'not_deleted') {
      query = query.neq('status', 'deleted').neq('approval_status', 'deleted');
    } else {
      // Generischer Status: status ODER approval_status matcht
      query = query.or(`status.eq.${status},approval_status.eq.${status}`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(r => ({
    ...r,
    _source: table,
    // Normalisiere approval_status für UI
    approval_status: r.approval_status
      ?? (SUBMITTED_STATES.includes(r.status) ? 'pending'
        : r.status === 'published' ? 'approved'
        : r.status === 'rejected'  ? 'rejected'
        : r.status === 'draft'     ? 'draft'
        : r.status ?? null),
  }));
}

export async function GET(req: NextRequest) {
  const guard = await guardUser(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit  = Math.min(parseInt(searchParams.get('limit') || '500', 10), 2000);

    // Beide Tabellen parallel abfragen
    const [experiences, projects] = await Promise.all([
      fetchTable('experiences', status, limit),
      fetchTable('projects', status, limit).catch(() => [] as ReturnType<typeof fetchTable> extends Promise<infer T> ? T : never[]),
    ]);

    const combined = [...experiences, ...projects].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Dual-Format: Array UND {items} — Hook-kompatibel
    return ok(combined);
  } catch (err) {
    return serverError(err, 'experiences GET');
  }
}
