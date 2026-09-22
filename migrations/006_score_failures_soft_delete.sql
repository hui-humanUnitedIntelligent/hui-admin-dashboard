-- SCORE-FAILURES-DELETE-001 (2026-09-22)
-- UI + employee APIs already implement two-stage deletion, but the backing table
-- never received these columns. Additive and backward-compatible.
ALTER TABLE public.impact_score_failures
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'impact_score_failures_status_check'
      AND conrelid = 'public.impact_score_failures'::regclass
  ) THEN
    ALTER TABLE public.impact_score_failures
      ADD CONSTRAINT impact_score_failures_status_check
      CHECK (status IN ('active', 'deleted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_impact_score_failures_status_created
  ON public.impact_score_failures (status, created_at DESC);
