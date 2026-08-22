// frontend/src/lib/hooks/useUsageAnalytics.ts
// SADB-ANALYSE-005 (2026-08-22): Pollt /api/usage-analytics für die
// App-Nutzungs-Kennzahlen (DAU/WAU/MAU, Ø Sitzungsdauer etc.) — analog
// zum useDashboard()-Pattern. 30s-Polling, kein Realtime nötig.
import { useState, useEffect, useRef } from 'react';

export interface UsageData {
  dau: number;
  wau: number;
  mau: number;
  avgDau7: number;
  sessionsToday: number;
  sessions7d: number;
  sessions30d: number;
  avgSessionSeconds: number;
  avgSessionsPerUserPerDay: number;
  dailyUniques7: number[];
  loading: boolean;
  error: string | null;
}

export function useUsageAnalytics(pollMs = 30000): UsageData {
  const [data, setData] = useState<UsageData>({
    dau: 0, wau: 0, mau: 0, avgDau7: 0,
    sessionsToday: 0, sessions7d: 0, sessions30d: 0,
    avgSessionSeconds: 0, avgSessionsPerUserPerDay: 0,
    dailyUniques7: [],
    loading: true,
    error: null,
  });
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/usage-analytics', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled && !json.error) {
          setData({ ...json, loading: false, error: null });
        } else if (cancelled) {
          // ignore
        } else {
          setData(d => ({ ...d, loading: false, error: json.error || 'unknown' }));
        }
      } catch (e: any) {
        if (!cancelled) setData(d => ({ ...d, loading: false, error: e?.message || 'fetch_error' }));
      }
    };
    fetchData();
    timer.current = setInterval(fetchData, pollMs);
    return () => { cancelled = true; if (timer.current) clearInterval(timer.current); };
  }, [pollMs]);

  return data;
}
