// frontend/src/lib/hooks/usePaginatedList.ts
// ── Einheitliches Listen-Pagination-Muster für alle Admin-Dashboard-Listen ──────
// Verhalten (Michael, 2026-07-03): Standardmäßig 10 Einträge sichtbar, nach Datum
// sortiert (neueste zuerst). Klick auf "Mehr laden" erweitert in 10er-Schritten
// bis maximal 50 pro Seite. Sind mehr als 50 Einträge vorhanden, schaltet eine
// echte Seiten-Navigation (Seite 1, 2, 3, ...) auf den nächsten 50er-Block um.
'use client';

import { useMemo, useState, useEffect } from 'react';

const INITIAL_VISIBLE = 10;
const STEP            = 10;
const PAGE_SIZE        = 50;

export interface UsePaginatedListResult<T> {
  /** Aktuell sichtbare Einträge (bereits sortiert, gefiltert auf Seite + sichtbaren Ausschnitt) */
  pageItems:      T[];
  /** true wenn "Mehr laden" noch etwas bringen würde (< 50 auf dieser Seite sichtbar) */
  canLoadMore:    boolean;
  /** um STEP erweitern (max. PAGE_SIZE bzw. Rest der aktuellen Seite) */
  loadMore:       () => void;
  /** aktuelle Seite (1-basiert) */
  page:           number;
  /** Gesamtzahl der Seiten (bei PAGE_SIZE=50 pro Seite) */
  totalPages:     number;
  /** zu einer Seite springen (setzt sichtbaren Ausschnitt auf 10 zurück) */
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
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

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
    if (page > totalPages) { setPage(1); setVisible(INITIAL_VISIBLE); }
  }, [totalPages, page]);

  const pageSlice = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  );

  const pageItems = useMemo(() => pageSlice.slice(0, visible), [pageSlice, visible]);

  const canLoadMore = visible < Math.min(PAGE_SIZE, pageSlice.length);

  const loadMore = () => setVisible(v => Math.min(PAGE_SIZE, v + STEP));

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    setVisible(INITIAL_VISIBLE);
  };

  return { pageItems, canLoadMore, loadMore, page, totalPages, goToPage, total: sorted.length };
}
