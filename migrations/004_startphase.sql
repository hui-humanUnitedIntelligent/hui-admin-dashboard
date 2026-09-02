-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 004_startphase.sql
-- HUI Startphase — Bewerbungsverwaltung
-- Erstellt zwei Tabellen: startphase_applications + startphase_communications
-- RLS: Öffentliche Insert erlaubt, alles andere gesperrt. Admin via Service Role.
-- Idempotent: kann mehrfach ausgeführt werden.
--
-- HINWEIS: current_role ist ein PostgreSQL-Schlüsselwort → verwendet current_role_text.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1. ENUM: startphase_status ════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE startphase_status AS ENUM (
    'new',       -- Neu eingegangen
    'review',    -- In Prüfung
    'question',  -- Rückfrage an Bewerber
    'accepted',  -- Angenommen
    'rejected',  -- Nicht ausgewählt
    'completed'  -- Abgeschlossen
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ═══ 2. TABLE: startphase_applications ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.startphase_applications (
  -- Primary key
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Persönliche Daten ──
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL,

  -- ── Vorausgewähltes Interesse (von "Was bringst du mit?" Chips) ──
  -- Werte: idea, talent, experience, time, support, curiosity
  interest        TEXT,

  -- ── Weitere Felder ──
  country_region  TEXT,
  current_role_text TEXT,            -- current_role ist PG-reserviert → current_role_text
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

  -- ── Status & Consent ──
  status          startphase_status NOT NULL DEFAULT 'new',
  consent_accepted BOOLEAN NOT NULL DEFAULT false,

  -- ── Admin-Notizen (optional, nur Admin) ──
  admin_notes     TEXT,

  -- ── Timestamps ──
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ 3. TABLE: startphase_communications ═══════════════════════════════════
CREATE TABLE IF NOT EXISTS public.startphase_communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key zur Bewerbung
  application_id  UUID NOT NULL REFERENCES public.startphase_applications(id) ON DELETE CASCADE,

  -- Wer hat gesendet (Admin-ID aus Supabase Auth)
  admin_id        TEXT,
  admin_name      TEXT,

  -- Richtung: outbound = Admin → Bewerber
  direction       TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound', 'system')),

  -- Inhalt
  subject         TEXT NOT NULL,
  message_body    TEXT NOT NULL,

  -- Versandstatus
  sent            BOOLEAN DEFAULT false,
  resend_id       TEXT,
  error           TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ 4. INDEXES ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_startphase_apps_status   ON public.startphase_applications(status);
CREATE INDEX IF NOT EXISTS idx_startphase_apps_email    ON public.startphase_applications(email);
CREATE INDEX IF NOT EXISTS idx_startphase_apps_created  ON public.startphase_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_startphase_apps_interest ON public.startphase_applications(interest);

CREATE INDEX IF NOT EXISTS idx_startphase_comm_app_id    ON public.startphase_communications(application_id);
CREATE INDEX IF NOT EXISTS idx_startphase_comm_created   ON public.startphase_communications(created_at DESC);

-- ═══ 5. TRIGGER: updated_at automatisch setzen ═════════════════════════════
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
-- RLS aktivieren
ALTER TABLE public.startphase_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startphase_communications ENABLE ROW LEVEL SECURITY;

-- ── startphase_applications: Nur INSERT für anonyme Nutzer (Bewerbung abgeben) ──
DROP POLICY IF EXISTS "startphase_apps_public_insert" ON public.startphase_applications;
CREATE POLICY "startphase_apps_public_insert"
  ON public.startphase_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ── KEIN SELECT/UPDATE/DELETE für anon oder authenticated (nur Service Role = Admin) ──
-- Service Role umgeht RLS automatisch — kein Policy nötig.
-- Durch das Fehlen von SELECT/UPDATE/DELETE Policies für anon/authenticated
-- können reguläre Nutzer keine Bewerbungen lesen, ändern oder löschen.

-- ── startphase_communications: Vollständig gesperrt für non-admin ──
-- Keine INSERT/SELECT/UPDATE/DELETE Policies für anon/authenticated.
-- Nur Service Role (Admin) kann zugreifen.

-- ═══ 7. COMMENTS ═══════════════════════════════════════════════════════════
COMMENT ON TABLE public.startphase_applications IS
  'HUI Startphase — Bewerbungen von der öffentlichen Website. RLS: nur INSERT für anon, Admin via Service Role.';
COMMENT ON TABLE public.startphase_communications IS
  'HUI Startphase — Kommunikationshistorie. RLS: voll gesperrt für non-admin, Admin via Service Role.';
COMMENT ON COLUMN public.startphase_applications.interest IS
  'Vorausgewähltes Interesse von "Was bringst du mit?" Chips. Werte: idea, talent, experience, time, support, curiosity.';
COMMENT ON COLUMN public.startphase_applications.current_role_text IS
  'Aktuelle Tätigkeit/Rolle des Bewerbers (Freitext). current_role ist PG-reserviert, daher current_role_text.';
COMMENT ON COLUMN public.startphase_applications.contributions IS
  'Checkbox-Auswahl aus dem Formular. JSON-Array von Werten: project, work, experience, talent, pioneer, idea, connector, explore, other, time, support, curiosity.';
COMMENT ON COLUMN public.startphase_applications.status IS
  'Bearbeitungsstatus: new, review, question, accepted, rejected, completed.';

-- ═══ FERTIG ═════════════════════════════════════════════════════════════════
