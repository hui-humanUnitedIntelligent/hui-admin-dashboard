// frontend/src/lib/hooks/useSupabaseRealtime.ts
// Zentraler Realtime-Hook: feuert onRefresh bei jeder DB-Änderung in den überwachten Tabellen
import { useEffect, useRef } from 'react';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const PROJECT_REF   = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Tabellen die live überwacht werden
const WATCH_TABLES = [
  'profiles', 'payments', 'bookings', 'works',
  'impact_projects', 'impact_applications', 'memberships',
];

// Root-Cause-Fix (Safari SecurityError-Crash, 2026-08-31):
// `new WebSocket()` kann in manchen Browsern (v.a. Safari mit "Cross-Site-
// Tracking verhindern" / Privatmodus) synchron eine SecurityError werfen.
// Das geschah bisher UNGESCHÜTZT direkt im useEffect -> React fängt den Wurf
// als Render-/Effect-Fehler und die komplette Seite crasht auf die
// Error-Boundary (error.tsx). Zusätzlich hätte ein dauerhaft fehlschlagender
// WebSocket den `onclose`-Reconnect (alle 3s) für immer wiederholt.
// Fix: alles in try/catch, begrenzte Retries mit Backoff, danach stiller
// Abbruch -> Dashboard läuft einfach mit Polling weiter (siehe useDashboard).
const MAX_RETRIES = 5;

interface Options {
  onRefresh: () => void;
  /** Debounce: min. ms zwischen zwei Refreshes (default 1500) */
  debounceMs?: number;
}

export function useSupabaseRealtime({ onRefresh, debounceMs = 1500 }: Options) {
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef       = useRef<WebSocket | null>(null);
  const pingRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const stoppedRef  = useRef(false);
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  useEffect(() => {
    if (!PROJECT_REF || !SUPABASE_ANON) return;
    if (typeof WebSocket === 'undefined') return; // kein WebSocket-Support -> nur Polling

    stoppedRef.current = false;
    attemptsRef.current = 0;

    const wsUrl = `wss://${PROJECT_REF}.supabase.co/realtime/v1/websocket?apikey=${SUPABASE_ANON}&vsn=1.0.0`;

    function triggerRefresh() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(), debounceMs);
    }

    function scheduleReconnect() {
      if (stoppedRef.current) return;
      attemptsRef.current += 1;
      if (attemptsRef.current > MAX_RETRIES) {
        // Aufgeben — Dashboard bleibt über Polling (refreshInterval) aktuell.
        console.warn('[Realtime] WebSocket dauerhaft nicht erreichbar — falle auf Polling zurück.');
        stoppedRef.current = true;
        return;
      }
      const backoff = Math.min(3000 * attemptsRef.current, 15000);
      reconnectRef.current = setTimeout(connect, backoff);
    }

    function connect() {
      if (stoppedRef.current) return;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          attemptsRef.current = 0; // erfolgreiche Verbindung -> Zähler zurücksetzen
          try {
            // Alle Tabellen subscriben
            WATCH_TABLES.forEach(table => {
              ws.send(JSON.stringify({
                topic: `realtime:public:${table}`,
                event: 'phx_join',
                payload: { config: { broadcast: { self: true }, postgres_changes: [
                  { event: '*', schema: 'public', table },
                ] } },
                ref: table,
              }));
            });

            // Heartbeat alle 25s
            pingRef.current = setInterval(() => {
              try {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
                }
              } catch { /* Verbindung evtl. schon weg — nächster onclose räumt auf */ }
            }, 25000);
          } catch (e) {
            console.warn('[Realtime] onopen-Handler fehlgeschlagen:', e);
          }
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            const event = msg.event ?? '';
            // postgres_changes INSERT/UPDATE/DELETE → refresh
            if (event === 'postgres_changes' ||
                (msg.payload?.type && ['INSERT','UPDATE','DELETE'].includes(msg.payload.type))) {
              triggerRefresh();
            }
          } catch { /* ignore */ }
        };

        ws.onclose = () => {
          if (pingRef.current) clearInterval(pingRef.current);
          scheduleReconnect();
        };

        // WICHTIG: hier NICHT ws.close() aufrufen (kann selbst wieder werfen) —
        // nur loggen, onclose feuert danach ohnehin und übernimmt den Reconnect.
        ws.onerror = () => { /* wird von onclose behandelt */ };
      } catch (e) {
        // Genau der Fall aus dem Safari-Crash: new WebSocket() wirft synchron
        // (z.B. SecurityError). Jetzt sauber abgefangen statt die Seite zu crashen.
        console.warn('[Realtime] WebSocket-Verbindung fehlgeschlagen:', e);
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      stoppedRef.current = true;
      if (timerRef.current)     clearTimeout(timerRef.current);
      if (pingRef.current)      clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null; // kein reconnect beim Unmount
          wsRef.current.onerror = null;
          wsRef.current.close();
        } catch { /* ignore */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceMs]);
}
