// frontend/src/app/api/export/route.ts
// Server-side export — service role key, supports CSV and JSON (Excel built client-side)

import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TABLE_CONFIGS: Record<string, { columns: string[]; label: string }> = {
  profiles: {
    label: 'Nutzer',
    columns: ['id','display_name','username','full_name','email','role','membership_type','is_member',
              'is_wirker','trust_score','impact_eur','follower_count','followers_count',
              'location_label','created_at','last_seen'],
  },
  payments: {
    label: 'Zahlungen',
    columns: ['id','user_id','amount','currency','status','type','description',
              'stripe_id','created_at','updated_at'],
  },
  works: {
    label: 'Werke',
    columns: ['id','user_id','title','category','status','visibility','price_eur',
              'currency','sale_mode','likes_count','comments_count','views_count',
              'saves_count','shares_count','published_at','created_at'],
  },
  bookings: {
    label: 'Buchungen',
    columns: ['id','user_id','work_id','status','price','currency','note','created_at','updated_at'],
  },
  impact_projects: {
    label: 'Impact Projekte',
    columns: ['id','name','category','status','votes','awarded_eur','month',
              'contact_name','contact_email','distributed_at','created_at'],
  },
  impact_pool: {
    label: 'Impact Pool',
    columns: ['id','month','total_eur','distributed_eur','state','voting_ends_at',
              'distributed_at','created_at'],
  },
  memberships: {
    label: 'Mitgliedschaften',
    columns: ['id','user_id','plan','status','started_at','ends_at','amount_eur',
              'stripe_subscription_id','created_at'],
  },
  orders: {
    label: 'Bestellungen',
    columns: ['id','user_id','work_id','status','total_eur','currency','created_at'],
  },
  wirker_profiles: {
    label: 'Wirker Profile (neu)',
    columns: ['id','user_id','slug','talent','wirker_type','tagline','categories',
              'skills','location_label','radius_km','hourly_rate','is_available',
              'booking_count','recommendation_count','impact_contributed_eur',
              'stripe_onboarded','created_at','updated_at'],
  },
  wirker: {
    label: 'Wirker Talente',
    columns: ['id','user_id','full_name','name','talent','location','bio',
              'hourly_rate','skills','recommendations','bookings','followers',
              'impact_eur','verified','created_at'],
  },
  activity_logs: {
    label: 'Audit Logs',
    columns: ['id','admin_id','action','target_id','target_type','details','created_at'],
  },
};

async function fetchAll(table: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const select = columns.join(',');
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&order=created_at.desc&limit=10000`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(';');
  const lines = rows.map(row =>
    columns.map(col => {
      const v = row[col];
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.includes(';') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';')
  );
  return [header, ...lines].join('\r\n');
}

export async function GET(req: NextRequest) {
  if (!SERVICE_KEY) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const tables  = (searchParams.get('tables') || '').split(',').filter(Boolean);
  const format  = searchParams.get('format') || 'json'; // json | csv

  if (!tables.length) {
    return NextResponse.json({ available: Object.entries(TABLE_CONFIGS).map(([k,v]) => ({ key: k, label: v.label })) });
  }

  const results: Record<string, unknown[]> = {};
  for (const t of tables) {
    const cfg = TABLE_CONFIGS[t];
    if (!cfg) continue;
    results[t] = await fetchAll(t, cfg.columns);
  }

  if (format === 'csv') {
    if (tables.length === 1) {
      const t = tables[0];
      const cfg = TABLE_CONFIGS[t];
      if (!cfg) return NextResponse.json({ error: 'Unknown table' }, { status: 400 });
      const csv = toCSV(results[t] as Record<string, unknown>[], cfg.columns);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${cfg.label}_${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }
    // Multi-table: return JSON with all CSVs
    const out: Record<string, string> = {};
    for (const t of tables) {
      const cfg = TABLE_CONFIGS[t];
      if (cfg) out[t] = toCSV(results[t] as Record<string, unknown>[], cfg.columns);
    }
    return NextResponse.json(out);
  }

  return NextResponse.json(results);
}
