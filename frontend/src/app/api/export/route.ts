// frontend/src/app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardSuperAdmin } from '@/app/lib/auth-guard';
import { ok, fail } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

const TABLE_CONFIGS: Record<string, { columns: string[]; label: string; orderCol?: string }> = {
  profiles: {
    label: 'Nutzerliste',
    columns: ['id','email','display_name','username','full_name','role','membership_type',
              'is_wirker','is_member','blocked','blocked_at','phone','bio','tagline',
              'location','location_label','impact_eur','trust_score','last_seen_at','created_at'],
  },
  payments: {
    label: 'Zahlungen',
    columns: ['id','user_id','amount','currency','status','type','description',
              'stripe_payment_id','stripe_session_id','created_at','updated_at'],
  },
  orders: {
    label: 'Bestellungen',
    columns: ['id','user_id','status','total_amount','currency','stripe_session_id','created_at'],
    orderCol: 'created_at',
  },
  order_items: {
    label: 'Bestellpositionen',
    columns: ['id','order_id','work_id','quantity','unit_price','total_price','created_at'],
    orderCol: 'created_at',
  },
  // memberships: deaktiviert — Tabelle noch nicht angelegt
  works: {
    label: 'Werke',
    columns: ['id','user_id','title','category','status','visibility','price','currency',
              'pricing_type','sale_mode','created_at','updated_at'],
  },
  experiences: {
    label: 'Erlebnisse & Projekte',
    columns: ['id','user_id','title','experience_type','category','status','visibility',
              'price','currency','date','created_at','updated_at'],
  },
  bookings: {
    label: 'Buchungen',
    columns: ['id','user_id','work_id','status','price','currency','booking_date',
              'notes','created_at','updated_at'],
  },
  impact_projects: {
    label: 'Impact Projekte',
    columns: ['id','name','category','status','votes','live_votes','awarded_eur',
              'month','contact_name','created_at'],
  },
  impact_applications: {
    label: 'Impact Bewerbungen',
    columns: ['id','user_id','project_id','status','message','created_at'],
  },
  impact_pool: {
    label: 'Impact Pool',
    columns: ['id','month','total_eur','distributed_eur','state','voting_ends_at','distributed_at','created_at'],
    orderCol: 'month',
  },
  wirker_profiles: {
    label: 'Wirker Profile',
    columns: ['id','user_id','slug','talent','tagline','category','hourly_rate',
              'availability','verified','created_at'],
  },
  website_reviews: {
    label: 'Webseite Reviews',
    columns: ['id','name','username','rating','comment','status','created_at'],
  },
  // activity_logs: deaktiviert — Tabelle noch nicht angelegt
};

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (v: unknown): string => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return (s.includes(';') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.join(';');
  const lines  = rows.map(row => columns.map(col => escape(row[col])).join(';'));
  return [header, ...lines].join('\r\n');
}

export async function GET(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const tables = (searchParams.get('tables') || '').split(',').filter(Boolean);
    const format = searchParams.get('format') || 'json';

    if (!tables.length) {
      return ok(Object.entries(TABLE_CONFIGS).map(([key, v]) => ({ key, label: v.label })));
    }

    const sb = getServiceClient();
    const results: Record<string, unknown[]> = {};

    for (const t of tables) {
      const cfg = TABLE_CONFIGS[t];
      if (!cfg) continue;
      const orderCol = cfg.orderCol ?? 'created_at';
      const { data } = await sb
        .from(t)
        .select(cfg.columns.join(','))
        .order(orderCol, { ascending: false })
        .limit(10000);
      results[t] = data ?? [];
    }

    // Einzelne Tabelle als CSV
    if (format === 'csv' && tables.length === 1) {
      const t   = tables[0];
      const cfg = TABLE_CONFIGS[t];
      if (!cfg) return fail('Unbekannte Tabelle');
      const csv = toCSV(results[t] as Record<string, unknown>[], cfg.columns);
      const date = new Date().toISOString().slice(0, 10);
      return new NextResponse('\uFEFF' + csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="HUI_${cfg.label}_${date}.csv"`,
        },
      });
    }

    // Mehrere Tabellen als JSON
    return ok(results);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
}
