// frontend/src/app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

const TABLE_CONFIGS: Record<string, { columns: string[]; label: string }> = {
  profiles:        { label: 'Nutzer',              columns: ['id','display_name','username','full_name','email','role','membership_type','is_member','is_wirker','trust_score','impact_eur','follower_count','location_label','created_at','last_seen'] },
  payments:        { label: 'Zahlungen',            columns: ['id','user_id','amount','currency','status','type','description','stripe_id','created_at','updated_at'] },
  works:           { label: 'Werke',               columns: ['id','user_id','title','category','status','visibility','price_eur','currency','sale_mode','likes_count','comments_count','views_count','saves_count','shares_count','published_at','created_at'] },
  bookings:        { label: 'Buchungen',            columns: ['id','user_id','work_id','status','price','currency','note','created_at','updated_at'] },
  impact_projects: { label: 'Impact Projekte',      columns: ['id','name','category','status','votes','awarded_eur','month','contact_name','contact_email','created_at'] },
  memberships:     { label: 'Mitgliedschaften',     columns: ['id','user_id','plan','status','started_at','ends_at','amount_eur','stripe_subscription_id','created_at'] },
  wirker_profiles: { label: 'Wirker Profile',       columns: ['id','user_id','slug','talent','tagline','categories','skills','location_label','is_available','hourly_rate','booking_count','created_at'] },
  activity_logs:   { label: 'Audit Logs',           columns: ['id','admin_id','action','target_id','target_type','details','created_at'] },
};

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(';');
  const lines  = rows.map(row =>
    columns.map(col => {
      const v = row[col];
      if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.includes(';') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';')
  );
  return [header, ...lines].join('\r\n');
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const tables = (searchParams.get('tables') || '').split(',').filter(Boolean);
    const format = searchParams.get('format') || 'json';

    // Kein table → verfügbare Tabellen zurückgeben
    if (!tables.length) {
      return ok(Object.entries(TABLE_CONFIGS).map(([key, v]) => ({ key, label: v.label })));
    }

    const sb = getServiceClient();
    const results: Record<string, unknown[]> = {};

    for (const t of tables) {
      const cfg = TABLE_CONFIGS[t];
      if (!cfg) continue;
      const { data, error } = await sb
        .from(t).select(cfg.columns.join(','))
        .order('created_at', { ascending: false }).limit(10000);
      if (!error) results[t] = data ?? [];
    }

    if (format === 'csv' && tables.length === 1) {
      const t   = tables[0];
      const cfg = TABLE_CONFIGS[t];
      if (!cfg) return fail('Unbekannte Tabelle');
      const csv = toCSV(results[t] as Record<string, unknown>[], cfg.columns);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${cfg.label}_${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }

    return ok(results);
  } catch (err) {
    return serverError(err, 'export GET');
  }
}
