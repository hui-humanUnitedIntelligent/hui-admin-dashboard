// frontend/src/lib/hooks/useUserRealtime.ts
// ── Supabase Realtime Listener für profiles — v2 Live-Sync ───────────────
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { SUPABASE_URL, SUPABASE_ANON } from '../api';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimePayload {
  eventType: RealtimeEvent;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  table: string;
}

interface UseRealtimeOptions {
  table: string;
  event?: RealtimeEvent;
  onEvent: (payload: RealtimePayload) => void;
  enabled?: boolean;
}

// ── Core Realtime WebSocket hook (Supabase Realtime v2) ──────────────────
export function useSupabaseRealtime({
  table,
  event = '*',
  onEvent,
  enabled = true,
}: UseRealtimeOptions) {
  const wsRef      = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef    = useRef(0);
  const stoppedRef     = useRef(false);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON || !enabled) return;
    if (typeof WebSocket === 'undefined') return; // no WebSocket support
    if (stoppedRef.current) return;

    const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
    const wsUrl = `wss://${projectRef}.supabase.co/realtime/v1/websocket?apikey=${SUPABASE_ANON}&vsn=1.0.0`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

      ws.onopen = () => {
        attemptsRef.current = 0; // successful connection -> reset counter
        try {
          // 1. Phoenix join
          const channelId = `realtime:public:${table}`;
          const joinMsg = {
            topic: channelId,
            event: 'phx_join',
            payload: {
              config: {
                broadcast: { self: false },
                presence: { key: '' },
                postgres_changes: [
                  { event: event === '*' ? '*' : event, schema: 'public', table },
                ],
              },
              access_token: SUPABASE_ANON,
            },
            ref: '1',
          };
          ws.send(JSON.stringify(joinMsg));

          // 2. Heartbeat alle 25s
          heartbeatInterval = setInterval(() => {
            try {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
              }
            } catch { /* connection may be gone */ }
          }, 25000);
        } catch (e) {
          console.warn('[Realtime] useUserRealtime onopen failed:', e);
        }
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string);
          if (!data) return;

          // Ignore heartbeat ACK
          if (data.event === 'phx_reply' && data.ref === null) return;

          // Postgres changes
          if (data.event === 'postgres_changes') {
            const p = data.payload?.data as RealtimePayload;
            if (p) onEventRef.current(p);
          }

          // Supabase broadcast format
          if (data.payload?.type === 'broadcast' && data.payload?.event === 'postgres_changes') {
            const p = data.payload?.payload as RealtimePayload;
            if (p) onEventRef.current(p);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (stoppedRef.current || !enabled) return;
        attemptsRef.current += 1;
        if (attemptsRef.current > 5) {
          console.warn('[Realtime] useUserRealtime: WebSocket dauerhaft nicht erreichbar — stoppe Reconnect.');
          stoppedRef.current = true;
          return;
        }
        const backoff = Math.min(3000 * attemptsRef.current, 15000);
        reconnectTimer.current = setTimeout(connect, backoff);
      };
    } catch (e) {
      // WebSocket not supported / blocked (e.g. Safari SecurityError)
      console.warn('[Realtime] useUserRealtime WebSocket fehlgeschlagen:', e);
      if (stoppedRef.current || !enabled) return;
      attemptsRef.current += 1;
      if (attemptsRef.current > 5) {
        stoppedRef.current = true;
        return;
      }
      const backoff = Math.min(3000 * attemptsRef.current, 15000);
      reconnectTimer.current = setTimeout(connect, backoff);
    }
  }, [table, event, enabled]);

  useEffect(() => {
    stoppedRef.current = false;
    attemptsRef.current = 0;
    connect();
    return () => {
      stoppedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close();
        } catch { /* ignore */ }
      }
    };
  }, [connect]);
}

// ── Optimistic Realtime Hook: Profile changes ─────────────────────────────
// Gibt INSERT/UPDATE Payload direkt an die UI — kein Full-Refetch nötig
export function useProfilesRealtimeOptimistic({
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: {
  onInsert?: (profile: Record<string, unknown>) => void;
  onUpdate?: (profile: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  enabled?: boolean;
}) {
  useSupabaseRealtime({
    table: 'profiles',
    event: '*',
    enabled,
    onEvent: (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      if (eventType === 'INSERT' && onInsert) onInsert(newRow);
      if (eventType === 'UPDATE' && onUpdate) onUpdate(newRow);
      if (eventType === 'DELETE' && onDelete) onDelete((oldRow?.id as string) || '');
    },
  });
}

// ── Simple refresh hook (backward compat) ────────────────────────────────
export function useProfilesRealtime(onRefresh: () => void, enabled = true) {
  useSupabaseRealtime({
    table: 'profiles',
    event: '*',
    onEvent: () => onRefresh(),
    enabled,
  });
}
