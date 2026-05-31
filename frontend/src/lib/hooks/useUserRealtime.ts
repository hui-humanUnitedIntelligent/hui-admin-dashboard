// frontend/src/lib/hooks/useUserRealtime.ts
// ── Supabase Realtime Listener für profiles ───────────────────────────────
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

// ── Core Realtime WebSocket hook ─────────────────────────────────────────
export function useSupabaseRealtime({
  table,
  event = '*',
  onEvent,
  enabled = true,
}: UseRealtimeOptions) {
  const wsRef      = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON || !enabled) return;

    // Extract project ref from URL: https://xxxx.supabase.co
    const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
    const wsUrl = `wss://${projectRef}.supabase.co/realtime/v1/websocket?apikey=${SUPABASE_ANON}&vsn=1.0.0`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Join channel: realtime:public:<table>
        const joinMsg = {
          topic:   `realtime:public:${table}`,
          event:   'phx_join',
          payload: {
            config: {
              broadcast: { self: false },
              presence:  { key: '' },
              postgres_changes: [
                { event, schema: 'public', table },
              ],
            },
          },
          ref: '1',
        };
        ws.send(JSON.stringify(joinMsg));
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);

          // Heartbeat
          if (data.event === 'phx_reply' && data.payload?.status === 'ok') return;
          if (data.event === 'heartbeat') {
            ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
            return;
          }

          if (data.event === 'postgres_changes') {
            const payload = data.payload?.data as RealtimePayload;
            if (payload) onEventRef.current(payload);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        // Reconnect after 3s
        if (enabled) setTimeout(connect, 3000);
      };
    } catch {
      // WebSocket not supported / blocked
    }
  }, [table, event, enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent auto-reconnect on cleanup
        wsRef.current.close();
      }
    };
  }, [connect]);
}

// ── Specialized: watch profiles table ────────────────────────────────────
export function useProfilesRealtime(onRefresh: () => void, enabled = true) {
  useSupabaseRealtime({
    table: 'profiles',
    event: '*',
    onEvent: () => onRefresh(),
    enabled,
  });
}
