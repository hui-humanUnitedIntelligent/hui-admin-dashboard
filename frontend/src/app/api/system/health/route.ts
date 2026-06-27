// frontend/src/app/api/system/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  const check = new URL(req.url).searchParams.get('check') ?? 'db';

  try {
    if (check === 'db') {
      const sb = getServiceClient();
      const t0 = Date.now();
      const { data, error } = await sb.from('profiles').select('id').limit(1);
      if (error) return NextResponse.json({ ok: false, error: error.message });
      return NextResponse.json({ ok: true, rows: data?.length ?? 0, latency: Date.now() - t0 });
    }

    if (check === 'auth') {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
      const t0 = Date.now();
      const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
      return NextResponse.json({ ok: r.ok, latency: Date.now() - t0 });
    }

    if (check === 'storage') {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      const t0 = Date.now();
      const r = await fetch(`${url}/storage/v1/bucket`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      return NextResponse.json({ ok: r.ok, latency: Date.now() - t0 });
    }

    if (check === 'api') {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      if (!url || !key) return NextResponse.json({ ok: false, error: 'Env-Variablen fehlen' });
      return NextResponse.json({ ok: true, url });
    }

    if (check === 'server') {
      return NextResponse.json({ ok: true, version: process.env.npm_package_version ?? '15' });
    }

    return NextResponse.json({ ok: false, error: 'Unbekannter Check' }, { status: 400 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
