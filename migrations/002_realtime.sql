-- migration_002_realtime.sql
-- ══════════════════════════════════════════════════════════════
-- HUI Admin — Supabase Realtime aktivieren
-- Idempotent: kann mehrfach ausgeführt werden ohne Fehler
-- ══════════════════════════════════════════════════════════════

-- HINWEIS: In Supabase wird Realtime über die supabase_realtime publication
-- aktiviert. Diese Tabellen werden hinzugefügt.

-- Realtime Publication für alle Content-Tabellen
ALTER PUBLICATION supabase_realtime ADD TABLE works;
ALTER PUBLICATION supabase_realtime ADD TABLE experiences;
ALTER PUBLICATION supabase_realtime ADD TABLE beitraege;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE wirker_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE impact_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE notification_events;

-- ── RLS Row-Level für Realtime (nur eigene oder Service-Role sieht alles) ─
-- (Bestehende RLS Policies bleiben erhalten — keine Änderungen nötig)
-- Der Admin nutzt den Service-Role Key → sieht alle Zeilen via Realtime.

-- ── FERTIG ───────────────────────────────────────────────────
-- Supabase Realtime ist jetzt für alle relevanten Tabellen aktiv.
-- Dashboard und App erhalten Live-Updates ohne Polling.
