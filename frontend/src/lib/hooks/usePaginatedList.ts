// frontend/src/lib/hooks/usePaginatedList.ts
// ── Einheitliches Listen-Pagination-Muster für alle Admin-Dashboard-Listen ──────
// Verhalten (Michael, 2026-07-03): Feste 20 Einträge pro Seite, nach Datum
// sortiert (neueste zuerst). Kein "Mehr laden" — echte Seiten-Navigation
// (Seite 1, 2, 3, ...) direkt ab Eintrag 21.
'use client';

import { useMemo, useState, useEffect } from 'react';

const PAGE_SIZE = 20;

export interface UsePaginatedListResult<T> {
  /** Aktuell sichtbare Einträge (bereits sortiert, auf PAGE_SIZE begrenzt) */
  pageItems:      T[];
  /** aktuelle Seite (1-basiert) */
  page:           number;
  /** Gesamtzahl der Seiten (bei PAGE_SIZE=20 pro Seite) */
  totalPages:     number;
  /** zu einer Seite springen */
  goToPage:       (p: number) => void;
  /** Gesamtzahl aller (sortierten/gefilterten) Einträge */
  total:          number;
}

/**
 * @param items    Bereits gefilterte (Suche/Tab) Liste — wird hier NUR sortiert+paginiert.
 * @param dateKey  Feldname (oder Funktion), aus dem das Sortierdatum gelesen wird.
 */
export function usePaginatedList<T>(
  items: T[],
  dateKey: keyof T | ((item: T) => string | number | null | undefined),
): UsePaginatedListResult<T> {
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const getDate = (item: T): number => {
      const raw = typeof dateKey === 'function' ? dateKey(item) : item[dateKey];
      const t = raw ? new Date(raw as string).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };
    return [...items].sort((a, b) => getDate(b) - getDate(a));
  }, [items, dateKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  // Wenn sich die Datenmenge ändert (Filter/Tab-Wechsel, Realtime-Update) und die
  // aktuelle Seite dadurch nicht mehr existiert, sicher auf Seite 1 zurückfallen.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pageItems = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  );

  const goToPage = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

  return { pageItems, page, totalPages, goToPage, total: sorted.length };
}
