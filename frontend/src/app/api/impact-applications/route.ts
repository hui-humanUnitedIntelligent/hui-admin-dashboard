// frontend/src/app/api/impact-applications/route.ts
// GET: Liste aller Impact-Bewerbungen (mit Filterung)
// POST: Bulk-Status-Update

import { NextRequest } from 'next/server';
import { guardSuperAdmin, guardSuperAdmin } from '@/app/lib/auth-guard';
import { ok, serverError, validationError, created } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

import { APPLICATION_STATUS } from '@/lib/impact-status';

export async function GET(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const sb     = getServiceClient();
    const params = new URL(req.url).searchParams;
    const status = params.get('status');  // pending | approved | rejected | all
    const limit  = Math.min(Number(params.get('limit') ?? 500), 500);
    const skip   = Number(params.get('skip') ?? 0);

    let query = sb
      .from('impact_applications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Statistiken
    const { data: counts } = await sb
      .from('impact_applications')
      .select('status');
    const stats = {
      total:    counts?.length ?? 0,
      pending:  counts?.filter(r => r.status === 'pending').length  ?? 0,
      approved: counts?.filter(r => r.status === 'approved').length ?? 0,
      rejected: counts?.filter(r => r.status === 'rejected').length ?? 0,
    };

    return ok({ applications: data ?? [], total: count ?? 0, stats, hasMore: (skip + limit) < (count ?? 0) });
  } catch (err) {
    return serverError(err, 'impact-applications GET');
  }
}

// POST: Neue Impact-Bewerbung anlegen
export async function POST(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const { project_name, user_id } = body as { project_name?: string; user_id?: string };

    if (!project_name?.trim()) return validationError({ project_name: 'Pflichtfeld' });
    if (!user_id?.trim())      return validationError({ user_id: 'Pflichtfeld' });

    const sb  = getServiceClient();
    const now = new Date().toISOString();

    const { data, error } = await sb
      .from('impact_applications')
      .insert({
        ...body,
        status:       'pending',
        submitted_at: now,
        created_at:   now,
      })
      .select()
      .single();

    if (error) throw error;

    // Activity Log
    try {
      await sb.from('activity_logs').insert({
        action:    'impact_application_created',
        actor_id:  user_id,
        target_id: data.id,
        metadata:  { project_name: data.project_name },
        created_at: now,
      });
    } catch (_) {}

    return created(data);
  } catch (err) {
    return serverError(err, 'impact-applications POST');
  }
}
