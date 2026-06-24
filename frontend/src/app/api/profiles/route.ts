// frontend/src/app/api/profiles/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(req.url);
    const limit  = parseInt(searchParams.get('limit')  || '1000', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `display_name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%,id.eq.${search}`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return ok({ profiles: data ?? [], total: count ?? 0 });
  } catch (err) {
    return serverError(err, 'profiles GET');
  }
}
