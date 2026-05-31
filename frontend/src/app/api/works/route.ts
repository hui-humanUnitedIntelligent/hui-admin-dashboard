// frontend/src/app/api/works/route.ts
// Server-side works query — uses SUPABASE_SERVICE_ROLE_KEY (never exposed to browser)

import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(req: NextRequest) {
  if (!SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: 'Service key not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const status  = searchParams.get('status');
  const limit   = searchParams.get('limit') || '500';
  const order   = searchParams.get('order') || 'updated_at.desc';

  const url = new URL(`${SUPABASE_URL}/rest/v1/works`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', order);
  url.searchParams.set('limit', limit);
  if (status) url.searchParams.set('status', `eq.${status}`);

  const res = await fetch(url.toString(), {
    headers: {
      apikey:         SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
