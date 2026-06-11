// frontend/src/app/api/experiences/route.ts
// Server-side experiences+projects query — uses SUPABASE_SERVICE_ROLE_KEY
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ── Felder inkl. approval_status ─────────────────────────────────────────
const SELECT_FIELDS = 'id,user_id,title,category,description,price,status,approval_status,rejection_reason,is_update,admin_comment,sensitivity_status,sensitivity_reason,cover_url,images,location_text,format,duration,date,time_start,time_end,experience_type,max_participants,created_at,updated_at,last_submitted_at';

interface RawEntry {
  id:                 string;
  user_id:            string;
  title:              string;
  category:           string;
  description?:       string;
  price?:             number | null;
  status:             string;
  approval_status?:   string | null;
  rejection_reason?:  string | null;
  cover_url?:         string | null;
  images?:            string | null;
  location_text?:     string | null;
  format?:            string | null;
  duration?:          string | null;
  created_at:         string;
  updated_at?:        string | null;
  last_submitted_at?: string | null;
  is_update?:         boolean | null;
  admin_comment?:     string | null;
  sensitivity_status?: string | null;
  sensitivity_reason?: string | null;
  date?:              string | null;
  time_start?:        string | null;
  time_end?:          string | null;
  experience_type?:   string | null;
  max_participants?:  number | null;
  _source?:           string;
}

async function queryTable(
  table: string,
  status: string | null,
  limit: string
): Promise<RawEntry[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', SELECT_FIELDS);
  url.searchParams.set('order',  'updated_at.desc.nullslast');
  url.searchParams.set('limit',  limit);

  // ── Status-Filter ────────────────────────────────────────────────────────
  // "pending" im Tab = approval_status=pending ODER status=pending_review
  // Supabase OR-Filter: ?or=(approval_status.eq.pending,status.eq.pending_review)
  if (status && status !== 'all') {
    if (status === 'pending') {
      // Eintraege die auf Freigabe warten
      url.searchParams.set('or', '(approval_status.eq.pending,status.eq.pending_review)');
    } else if (status === 'approved') {
      url.searchParams.set('approval_status', 'eq.approved');
    } else if (status === 'rejected') {
      url.searchParams.set('or', '(approval_status.eq.rejected,status.eq.rejected)');
    } else if (status === 'deleted') {
      url.searchParams.set('status', 'eq.deleted');
    } else if (status === 'draft') {
      url.searchParams.set('status', 'eq.draft');
    } else {
      url.searchParams.set('status', `eq.${status}`);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer:        'count=exact',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error(`[api/experiences] ${table} error ${res.status}:`, await res.text());
    return [];
  }

  const rows = await res.json() as RawEntry[];
  return rows.map(r => ({
    ...r,
    _source: table,
    // Normalisierung: approval_status aus status ableiten wenn noch nicht gesetzt
    approval_status: r.approval_status
      ?? (r.status === 'pending_review' ? 'pending'
          : r.status === 'published'    ? 'approved'
          : r.status === 'rejected'     ? 'rejected'
          : r.status === 'draft'        ? 'draft'
          : null),
  }));
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
