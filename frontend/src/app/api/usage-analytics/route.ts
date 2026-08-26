// frontend/src/app/api/usage-analytics/route.ts
// SADB-ANALYSE-005 (2026-08-22): App-Nutzungs-Kennzahlen für Analytics-Seite.
// Bewusst als EIGENE, kleine Route getrennt von /api/dashboard (SSOT für
// Umsatz/User/Buchungen) — andere Datenquelle (app_usage_sessions), kein
// Risiko für die bestehende Dashboard-Route. Service-Role-Client umgeht RLS
// für die aggregierte Auswertung; einzelne user_id werden NIE zurückgegeben,
// nur aggregierte Zahlen (Michael: "nicht wer, sondern wie oft/wie lange").
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const sb  = getServiceClient();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const day7  = new Date(now.getTime() - 7  * 86400000).toISOString();
    const day30 = new Date(now.getTime() - 30 * 86400000).toISOString();

    // Alle Sessions der letzten 30 Tage — reicht für DAU/WAU/MAU + Ø-Werte.
    // Nur die Spalten die wir brauchen, KEINE user_id im Response-Payload.
    const { data: sessions, error } = await sb
      .from('app_usage_sessions')
      .select('user_id, started_at, last_seen_at, duration_seconds')
      .gte('started_at', day30);

    if (error) throw error;

    const rows = sessions || [];

    const uniqueUsersInRange = (sinceIso: string) => {
      const set = new Set<string>();
      for (const r of rows) {
        if (r.started_at >= sinceIso || (r.last_seen_at && r.last_seen_at >= sinceIso)) {
          set.add(r.user_id);
        }
      }
      return set.size;
    };

    const sessionsInRange = (sinceIso: string) => rows.filter(r => r.started_at >= sinceIso).length;

    const durations = rows.map(r => r.duration_seconds).filter((d): d is number => typeof d === 'number' && d > 0);
    const avgSessionSeconds = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : 0;

    const usersLast30 = uniqueUsersInRange(day30);
    const sessions30  = rows.length;
    const avgSessionsPerUserPerDay = usersLast30 > 0
      ? Math.round((sessions30 / usersLast30 / 30) * 100) / 100
      : 0;

    // Ø DAU über letzte 7 Tage (für Trend-Aussage)
    const dailyUniques: number[] = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(now.getTime() - i * 86400000);
      const dayStartIso = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate()).toISOString();
      const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1).toISOString();
      const set = new Set<string>();
      for (const r of rows) {
        if (r.started_at >= dayStartIso && r.started_at < dayEnd) set.add(r.user_id);
      }
      dailyUniques.push(set.size);
    }
    const avgDau7 = Math.round(dailyUniques.reduce((s, d) => s + d, 0) / 7);

    return NextResponse.json({
      dau: uniqueUsersInRange(startOfToday),
      wau: uniqueUsersInRange(day7),
      mau: usersLast30,
      avgDau7,
      sessionsToday: sessionsInRange(startOfToday),
      sessions7d:    sessionsInRange(day7),
      sessions30d:   sessions30,
      avgSessionSeconds,
      avgSessionsPerUserPerDay,
      dailyUniques7: dailyUniques,
    });
  } catch (e: any) {
    console.error('[usage-analytics]', e?.message || e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
