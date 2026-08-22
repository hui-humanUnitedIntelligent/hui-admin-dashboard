// frontend/src/lib/hooks/usePendingCounts.ts
// BADGE-SYNC-001: Zähler für alle Content-Bereiche
// Strategie: 30s Polling als Basis + Supabase Realtime für sofortige Updates
// Tabellen: works, talents, experiences, beitraege, recommendation_reports,
//           impact_applications, impact_score_failures, bug_reports → reagieren jeweils auf INSERT/UPDATE/DELETE
//
// FIX (2026-08-21, GHOST-BADGE-002):
//   1. Bei API-Fehlern (non-ok, network error) → counts auf EMPTY zurücksetzen,
//      nicht stillschweigend alte Werte behalten (ursache für "Geister-1").
//   2. Click-to-Clear: markSeen(href) speichert den zuletzt gesehenen Count
//      in localStorage. Der Hook liefert "effective" Counts, die nur >0 sind
//      wenn der echte Count HÖHER ist als der zuletzt gesehene.
//   3. Bei echten neuen Items (Count steigt über seen-Wert) → Badge kommt zurück.
//
// BADGE-SYNC-005 (2026-08-22): + Fehlermeldungen (bug_reports, status='offen').
// Zusätzlich: getEffectiveCountForGroup(hrefs) — Summe der effektiven Counts
// über mehrere hrefs, damit die Gruppen-Header (Management/Inhalte/Tools/System)
// auch im eingeklappten Zustand einen Gesamt-Badge zeigen können.
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

export type PendingCounts = {
  works:              number;
  talents:            number;
  experiences:        number;
  momente:            number;
  recReports:         number;
  impactApplications: number;
  scoreFailures:      number;
  bugReports:         number;
  total:              number;
};

const EMPTY: PendingCounts = {
  works: 0, talents: 0, experiences: 0, momente: 0, recReports: 0,
  impactApplications: 0, scoreFailures: 0, bugReports: 0, total: 0,
};

const STORAGE_KEY = 'sadb_seen_counts';

// localStorage: { [href]: number } — letzter Count-Wert den der User gesehen hat
function getSeenCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function setSeenCounts(data: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

// Map: href → PendingCounts key
const HREF_TO_KEY: Record<string, keyof PendingCounts> = {
  '/works':                  'works',
  '/talent-offers':          'talents',
  '/experiences':            'experiences',
  '/momente':                'momente',
  '/recommendation-reports':  'recReports',
  '/impact-projekte':        'impactApplications',
  '/score-failures':         'scoreFailures',
  '/bug-reports':            'bugReports',
  '/employee/works':                  'works',
  '/employee/talent-offers':          'talents',
  '/employee/experiences':            'experiences',
  '/employee/recommendation-reports': 'recReports',
  '/employee/reasons':                'scoreFailures',
};

/** Markiert einen Bereich als "gesehen" — Badge verschwindet bis neue Items kommen. */
export function markSeen(href: string, currentCount: number) {
  const seen = getSeenCounts();
  seen[href] = currentCount;
  setSeenCounts(seen);
}

// Supabase Client für Realtime (anon key reicht — wir hören nur auf Schema-Events)
function getRealtimeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function usePendingCounts(intervalMs = 30_000) {
  const [counts, setCounts] = useState<PendingCounts>(EMPTY);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/pending-counts', { cache: 'no-store' });
      if (r.ok) {
        setCounts(await r.json());
      } else {
        // FIX: Bei non-ok Response (401, 500, etc.) -> auf 0 zuruecksetzen,
        // nicht alte Werte behalten. Alte Werte sind die Ursache fuer Geister-Badges.
        setCounts(EMPTY);
      }
    } catch {
      // FIX: Bei Network-Error -> auch auf 0 zuruecksetzen.
      setCounts(EMPTY);
    }
  }, []);

  // ── Polling (Fallback + erster Load) ──────────────────────────────────
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  // ── Realtime: sofortige Badge-Aktualisierung bei DB-Änderung ──────────
  useEffect(() => {
    const sb = getRealtimeClient();
    if (!sb) return;

    // Channel auf alle Tabellen hören, die Badges beeinflussen
    const channel = sb
      .channel('pending-counts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'works' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'talents' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'experiences' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'momente_reports' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'beitraege' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recommendation_reports' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'impact_applications' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'impact_score_failures' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bug_reports' },
        () => refresh()
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      sb.removeChannel(channel);
    };
  }, [refresh]);

  // ── Click-to-Clear: effective Counts nach "gesehen"-Status ──────────
  // Fuer jeden href: zeige Badge nur wenn echter Count > zuletzt gesehener Count
  const getEffectiveCount = useCallback((href: string): number => {
    const key = HREF_TO_KEY[href];
    if (!key) return 0;
    const actual = counts[key] ?? 0;
    const seen = getSeenCounts()[href] ?? 0;
    return Math.max(0, actual - seen);
  }, [counts]);

  // BADGE-SYNC-005: Summe der effektiven Counts über mehrere hrefs —
  // für Gruppen-Header-Badges (Management/Inhalte/Tools/System), die auch
  // im eingeklappten Zustand die Gesamtzahl offener Punkte zeigen sollen.
  const getEffectiveCountForGroup = useCallback((hrefs: string[]): number => {
    return hrefs.reduce((sum, href) => sum + getEffectiveCount(href), 0);
  }, [getEffectiveCount]);

  return {
    ...counts,
    getEffectiveCount,
    getEffectiveCountForGroup,
    markSeen: (href: string) => markSeen(href, counts[HREF_TO_KEY[href]] ?? 0),
  };
}
