-- migration_001_unified_status.sql
-- ══════════════════════════════════════════════════════════════
-- HUI Admin Dashboard — Unified Status Migration
-- Idempotent: kann mehrfach ausgeführt werden ohne Fehler
-- ══════════════════════════════════════════════════════════════

-- ── 1. Enum-Typ erstellen (idempotent) ────────────────────────
DO $$ BEGIN
  CREATE TYPE content_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected',
    'deleted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. works.status ──────────────────────────────────────────
-- Bestehende Werte mappen: 'published' → 'approved', 'pending_review' → 'pending'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='works' AND column_name='unified_status'
  ) THEN
    ALTER TABLE works ADD COLUMN unified_status content_status;
  END IF;
END $$;

-- Mapping: works.status + works.approval_status → unified_status
UPDATE works SET unified_status =
  CASE
    WHEN status = 'deleted'          THEN 'deleted'::content_status
    WHEN status = 'draft'            THEN 'draft'::content_status
    WHEN approval_status = 'rejected' OR status = 'rejected' THEN 'rejected'::content_status
    WHEN approval_status = 'approved' OR status = 'published' THEN 'approved'::content_status
    WHEN approval_status = 'pending' OR status IN ('pending', 'pending_review') THEN 'pending'::content_status
    ELSE 'draft'::content_status
  END
WHERE unified_status IS NULL;

-- ── 3. experiences.status ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='experiences' AND column_name='unified_status'
  ) THEN
    ALTER TABLE experiences ADD COLUMN unified_status content_status;
  END IF;
END $$;

UPDATE experiences SET unified_status =
  CASE
    WHEN status = 'deleted'            THEN 'deleted'::content_status
    WHEN status = 'draft'              THEN 'draft'::content_status
    WHEN approval_status = 'rejected' OR status = 'rejected' THEN 'rejected'::content_status
    WHEN approval_status = 'approved' OR status = 'published' THEN 'approved'::content_status
    WHEN approval_status = 'pending'  OR status = 'pending'   THEN 'pending'::content_status
    ELSE 'draft'::content_status
  END
WHERE unified_status IS NULL;

-- ── 4. beitraege.status ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='beitraege' AND column_name='unified_status'
  ) THEN
    ALTER TABLE beitraege ADD COLUMN unified_status content_status DEFAULT 'approved';
  END IF;
END $$;

UPDATE beitraege SET unified_status = 'approved'::content_status
WHERE unified_status IS NULL;

-- ── 5. moments.status ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='moments' AND column_name='unified_status'
  ) THEN
    ALTER TABLE moments ADD COLUMN unified_status content_status DEFAULT 'approved';
  END IF;
END $$;

UPDATE moments SET unified_status = 'approved'::content_status
WHERE unified_status IS NULL;

-- ── 6. Indexes für Performance ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_works_unified_status        ON works(unified_status);
CREATE INDEX IF NOT EXISTS idx_experiences_unified_status  ON experiences(unified_status);
CREATE INDEX IF NOT EXISTS idx_beitraege_unified_status    ON beitraege(unified_status);
CREATE INDEX IF NOT EXISTS idx_moments_unified_status      ON moments(unified_status);

-- ── 7. last_submitted_at ergänzen (falls fehlt) ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='experiences' AND column_name='last_submitted_at'
  ) THEN
    ALTER TABLE experiences ADD COLUMN last_submitted_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='works' AND column_name='last_submitted_at'
  ) THEN
    ALTER TABLE works ADD COLUMN last_submitted_at TIMESTAMPTZ;
  END IF;
END $$;

-- ── 8. notification_events Tabelle (Audit-Trail) ──────────────
CREATE TABLE IF NOT EXISTS notification_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   TEXT        NOT NULL,
  record_id    UUID        NOT NULL,
  action       TEXT        NOT NULL,  -- 'approve' | 'reject' | 'delete' | 'flag'
  old_status   TEXT,
  new_status   TEXT,
  admin_id     UUID,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_events_record ON notification_events(record_id);
CREATE INDEX IF NOT EXISTS idx_notif_events_table  ON notification_events(table_name);
CREATE INDEX IF NOT EXISTS idx_notif_events_ts     ON notification_events(created_at DESC);

-- ── FERTIG ───────────────────────────────────────────────────
-- Migration abgeschlossen. Alle Spalten sind idempotent hinzugefügt.
