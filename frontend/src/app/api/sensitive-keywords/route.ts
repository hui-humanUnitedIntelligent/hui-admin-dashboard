// frontend/src/app/api/sensitive-keywords/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('sensitive_keywords')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ok(data ?? []);
  } catch (err) {
    return serverError(err, 'sensitive-keywords GET');
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const { keyword } = body as { keyword?: string };
    if (!keyword?.trim()) {
      return (await import('@/app/lib/api-response')).validationError({ keyword: 'Pflichtfeld' });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('sensitive_keywords')
      .insert({ keyword: keyword.trim() })
      .select()
      .single();

    if (error) throw error;
    return (await import('@/app/lib/api-response')).created(data);
  } catch (err) {
    return serverError(err, 'sensitive-keywords POST');
  }
}
