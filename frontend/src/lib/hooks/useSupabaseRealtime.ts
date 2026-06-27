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

interface Options {
  onRefresh: () => void;
  /** Debounce: min. ms zwischen zwei Refreshes (default 1500) */
  debounceMs?: number;
}

export function useSupabaseRealtime({ onRefresh, debounceMs = 1500 }: Options) {
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef      = useRef<WebSocket | null>(null);
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  useEffect(() => {
    if (!PROJECT_REF || !SUPABASE_ANON) return;

    const wsUrl = `wss://${PROJECT_REF}.supabase.co/realtime/v1/websocket?apikey=${SUPABASE_ANON}&vsn=1.0.0`;

    function triggerRefresh() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(), debounceMs);
    }

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
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
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
          }
        }, 25000);
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
        // Auto-reconnect nach 3s
        setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      if (timerRef.current)  clearTimeout(timerRef.current);
      if (pingRef.current)   clearInterval(pingRef.current);
      if (wsRef.current)     wsRef.current.onclose = null; // kein reconnect beim Unmount
      wsRef.current?.close();
    };
  }, [debounceMs]);
}
