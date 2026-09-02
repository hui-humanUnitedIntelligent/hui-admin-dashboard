// frontend/src/app/api/startphase/migrate/route.ts
// Einmalige Migration: Erstellt startphase_applications + startphase_communications Tabellen
// Aufrufbar mit Admin-Auth ODER mit ?key=<MIGRATION_SECRET> (einmalig, dann entfernen)
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';
import { Pool } from 'pg';

const MIGRATION_SQL = `
-- ═══ 1. ENUM: startphase_status ════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE startphase_status AS ENUM (
    'new','review','question','accepted','rejected','completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ═══ 2. TABLE: startphase_applications ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.startphase_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  interest        TEXT,
  country_region  TEXT,
  current_role    TEXT,
  about_you       TEXT,
  contributions   JSONB DEFAULT '[]'::jsonb,
  skills          TEXT,
  project_name        TEXT,
  project_offering    TEXT,
  project_audience    TEXT,
  project_impact      TEXT,
  project_needs       TEXT,
  project_missing     TEXT,
  pioneer_reason      TEXT,
  pioneer_wishes      JSONB DEFAULT '[]'::jsonb,
  pioneer_first_action TEXT,
  why_hui         TEXT,
  what_contribute TEXT,
  status          startphase_status NOT NULL DEFAULT 'new',
  consent_accepted BOOLEAN NOT NULL DEFAULT false,
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ 3. TABLE: startphase_communications ═══════════════════════════════════
CREATE TABLE IF NOT EXISTS public.startphase_communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES public.startphase_applications(id) ON DELETE CASCADE,
  admin_id        TEXT,
  admin_name      TEXT,
  direction       TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound','system')),
  subject         TEXT NOT NULL,
  message_body    TEXT NOT NULL,
  sent            BOOLEAN DEFAULT false,
  resend_id       TEXT,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ 4. INDEXES ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_startphase_apps_status   ON public.startphase_applications(status);
CREATE INDEX IF NOT EXISTS idx_startphase_apps_email    ON public.startphase_applications(email);
CREATE INDEX IF NOT EXISTS idx_startphase_apps_created  ON public.startphase_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_startphase_apps_interest ON public.startphase_applications(interest);
CREATE INDEX IF NOT EXISTS idx_startphase_comm_app_id    ON public.startphase_communications(application_id);
CREATE INDEX IF NOT EXISTS idx_startphase_comm_created   ON public.startphase_communications(created_at DESC);

-- ═══ 5. TRIGGER: updated_at ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at_startphase()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_startphase_apps_updated_at ON public.startphase_applications;
CREATE TRIGGER trg_startphase_apps_updated_at
  BEFORE UPDATE ON public.startphase_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_startphase();

-- ═══ 6. RLS ═════════════════════════════════════════════════════════════════
ALTER TABLE public.startphase_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startphase_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "startphase_apps_public_insert" ON public.startphase_applications;
CREATE POLICY "startphase_apps_public_insert"
  ON public.startphase_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
`;

export async function POST(req: NextRequest) {
  // Auth: Admin OR migration secret
  const url = new URL(req.url);
  const secretKey = url.searchParams.get('key');
  const MIGRATION_SECRET = process.env.MIGRATION_SECRET || 'hui-startphase-migrate-2026';

  if (secretKey !== MIGRATION_SECRET) {
    const guard = await guardAdmin(req);
    if (guard) return guard;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

    // Try to get database connection string
    let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_STRING || '';

    if (!connectionString) {
      const dbPassword = process.env.POSTGRES_PASSWORD || process.env.SUPABASE_DB_PASSWORD || '';
      if (dbPassword) {
        connectionString = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;
      }
    }

    if (!connectionString) {
      // Fallback: check if tables already exist via REST API
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/startphase_applications?select=id&limit=1`, {
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
      });
      if (checkRes.ok) {
        return ok({ message: 'Tabellen existieren bereits', method: 'rest-check' });
      }

      return NextResponse.json({
        ok: false,
        error: 'Keine DATABASE_URL oder POSTGRES_PASSWORD gefunden. ' +
          'Bitte setze POSTGRES_PASSWORD in Vercel Environment Variables ' +
          '(Supabase Dashboard → Settings → Database → Connection String) ' +
          'oder führe migrations/004_startphase.sql manuell im Supabase SQL Editor aus.',
        supabaseUrl,
        projectRef,
      }, { status: 500 });
    }

    // Execute migration via direct PostgreSQL connection
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(MIGRATION_SQL);
      await client.query('COMMIT');
      return ok({ message: 'Migration erfolgreich ausgeführt', tables: ['startphase_applications', 'startphase_communications'] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    return serverError(err, 'startphase-migrate');
  }
}
