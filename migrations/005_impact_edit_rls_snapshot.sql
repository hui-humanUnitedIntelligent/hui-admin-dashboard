-- Migration 20260916_143_impact_edit_rls_snapshot
-- IMPACT-EDIT-RLS-001 + IMPACT-EDIT-SNAPSHOT-001 (Michael-Request 16.09.2026):
-- Projekt-Update-Workflow (Edit genehmigter Projekte -> SADB-Review) war DB-seitig blockiert.

-- 1) Spalten fuer Edit-Audit: Snapshot des letzten genehmigten Zustands + optionaler Grund
ALTER TABLE public.impact_applications
  ADD COLUMN IF NOT EXISTS edit_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS edit_reason text;

-- 2) UPDATE-Policy erweitern:
--    VORHER: USING (auth.uid() = user_id AND status = 'pending')
--            -> Owner konnte genehmigte Projekte NICHT bearbeiten (Edit-Flow blockiert)
--            -> Soft-Delete (status='deleted') war UNMOEGLICH (WITH CHECK fiel auf USING zurueck)
--    NAACHHER: Bearbeiten eigener Zeilen in pending/approved/rejected zulaessig;
--    Ergebnis-Zeile MUSS status IN ('pending','deleted') haben:
--      - Edit genehmigter Projekte geht nur mit Rueckfall auf 'pending' (= neuer SADB-Review)
--      - Nutzer kann sich NICHT selbst freigeben ('approved'/'published' nicht in WITH CHECK)
--      - Soft-Delete ('deleted') erlaubt (loescht nichts, Historie bleibt)
ALTER POLICY impact_apps_own_update ON public.impact_applications
  USING ((auth.uid() = user_id) AND (status IN ('pending','approved','rejected')))
  WITH CHECK ((auth.uid() = user_id) AND (status IN ('pending','deleted')));

-- 3) DELETE-Policy (fehlte KOMPLETT -- Hard-Delete war RLS-blockiert):
--    Owner darf eigene Antraege loeschen. DB-Foreign-Keys (impact_votes,
--    impact_milestones -> impact_applications) blockieren das Loeschen referenzierter
--    Projekte hart -- die App-Logik (Soft-Delete wenn Stimmen/Meilensteine) bleibt
--    sinnvoll, hat aber jetzt eine echte DB-Verteidigungslinie dahinter.
CREATE POLICY impact_apps_own_delete ON public.impact_applications
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4) Schutz-Trigger fuer Finanz-/Rank-Felder (Analog zu Prompt-Anforderung 6, adaptiert
--    auf die ECHTEN Spalten): User-Sessions (auth.uid() gesetzt) duerfen current_amount_eur,
--    rank, direct_supports, last_support_date, is_completed NICHT aendern.
--    Service-Role (SADB/Edge-Functions, auth.uid() IS NULL) ist unbeschraenkt.
CREATE OR REPLACE FUNCTION protect_impact_finance_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.current_amount_eur IS DISTINCT FROM OLD.current_amount_eur THEN
      RAISE EXCEPTION 'current_amount_eur darf nicht geändert werden';
    END IF;
    IF NEW.rank IS DISTINCT FROM OLD.rank THEN
      RAISE EXCEPTION 'rank darf nicht geändert werden';
    END IF;
    IF NEW.direct_supports IS DISTINCT FROM OLD.direct_supports THEN
      RAISE EXCEPTION 'direct_supports darf nicht geändert werden';
    END IF;
    IF NEW.last_support_date IS DISTINCT FROM OLD.last_support_date THEN
      RAISE EXCEPTION 'last_support_date darf nicht geändert werden';
    END IF;
    IF NEW.is_completed IS DISTINCT FROM OLD.is_completed THEN
      RAISE EXCEPTION 'is_completed darf nicht geändert werden';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_impact_finance_fields_trigger ON public.impact_applications;
CREATE TRIGGER protect_impact_finance_fields_trigger
  BEFORE UPDATE ON public.impact_applications
  FOR EACH ROW
  EXECUTE FUNCTION protect_impact_finance_fields();

-- 5) Migration registrieren
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260916114300', '20260916_143_impact_edit_rls_snapshot')
ON CONFLICT (version) DO NOTHING;
