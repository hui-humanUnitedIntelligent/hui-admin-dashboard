// frontend/src/app/api/experiences/route.ts
// Server-side experiences+projects query — uses SUPABASE_SERVICE_ROLE_KEY
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SELECT_FIELDS = 'id,user_id,title,category,description,price,status,rejection_reason,created_at,updated_at,last_submitted_at';

async function queryTable(table: string, status: string | null, limit: string) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', SELECT_FIELDS);
  url.searchParams.set('order',  'updated_at.desc');
  url.searchParams.set('limit',  limit);
  if (status && status !== 'all') url.searchParams.set('status', `eq.${status}`);
  const res = await fetch(url.toString(), {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const rows = await res.json() as Record<string, unknown>[];
  return rows.map(r => ({ ...r, _source: table }));
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_SERVICE_KEY)
    return NextResponse.json({ error: 'Service key not configured' }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const status  = searchParams.get('status');
  const limit   = searchParams.get('limit') || '500';

  const [expRows, projRows] = await Promise.all([
    queryTable('experiences', status, limit),
    queryTable('projects',    status, limit),
  ]);

  // Merge + sort by updated_at desc
  const all = [...expRows, ...projRows].sort((a, b) => {
    const da = new Date((a.updated_at || a.created_at) as string).getTime();
    const db = new Date((b.updated_at || b.created_at) as string).getTime();
    return db - da;
  });

  return NextResponse.json(all);
}
