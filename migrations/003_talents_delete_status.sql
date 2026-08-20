-- ═══════════════════════════════════════════════════════════════════
-- Migration: 20260820_123_talents_delete_status.sql
-- SADB "Talent löschen"-Bug (2026-08-20, Michael-Screenshot):
-- Der Löschen-Button in TalentOffersView.tsx / /api/talent-offers
-- (PATCH, _action='delete_talent') fuehrt einen Soft-Delete per
-- .update({ status: 'deleted', deletion_reason: deleteReason }) aus.
-- Zwei Root Causes, beide gefixt:
--
-- 1) Spalte "deletion_reason" existierte NICHT in public.talents
--    (PostgREST 400: "column deletion_reason does not exist").
-- 2) talents_status_check erlaubte nur ARRAY['pending','approved',
--    'rejected'] -- 'deleted' war nie Teil der Constraint, da
--    Soft-Delete via Status urspruenglich nicht vorgesehen war
--    (siehe TALENT-OFFERS-001, Memory #528: reiner Freigabe-Workflow).
--
-- Additiv (PRINZIP 5 Datenmigrations-Regel) -- erweitert nur Spalte
-- + erlaubte Werte, keine Struktur-Aenderung, keine Datenverluste.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Fehlende Spalte fuer die Loesch-Begruendung (Resonanzzentrum-Notification)
ALTER TABLE public.talents
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

COMMENT ON COLUMN public.talents.deletion_reason IS
  'Begründung des Admin-Löschvorgangs (Soft-Delete via status=deleted), erscheint im Resonanzzentrum des Erstellers.';

-- 2) 'deleted' als gültigen Status ergänzen (Soft-Delete durch SADB-Admin)
ALTER TABLE public.talents
  DROP CONSTRAINT IF EXISTS talents_status_check;

ALTER TABLE public.talents
  ADD CONSTRAINT talents_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'deleted'::text]));

COMMENT ON CONSTRAINT talents_status_check ON public.talents IS
  'Erlaubte Angebots-Status: pending (Prüfung), approved (Live), rejected (Abgelehnt), deleted (Admin-Soft-Delete via SADB).';
