// frontend/src/lib/hooks/useNotifications.ts
// ── HUI Admin — useNotifications Hook (Server-API + Realtime) ────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';

export interface AdminNotification {
  id:          string;
  user_id:     string;
  type:        string;
  title:       string | null;
  body:        string | null;
  is_read:     boolean;
  metadata:    Record<string, unknown> | null;
  entity_id:   string | null;
  entity_type: string | null;
  action_url:  string | null;
  created_at:  string;
}

export interface UseNotificationsOptions {
  userId?:          string;
  type?:            string;
  unreadOnly?:      boolean;
  limit?:           number;
  refreshInterval?: number;
  realtime?:        boolean;
}

export function useNotifications(opts: UseNotificationsOptions = {}) {
  const { userId, type, unreadOnly, limit = 100, refreshInterval = 0, realtime = true } = opts;

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [total,         setTotal]         = useState(0);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (userId)    params.set('user_id', userId);
      if (type)      params.set('type', type);
      if (unreadOnly) params.set('unread', 'true');

      const res = await fetch(`/api/notifications?${params}`, {
        headers: token ? { } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const d    = json.data ?? {};
      setNotifications(d.notifications ?? []);
      setTotal(d.total ?? 0);
      setUnreadCount(d.unreadCount ?? 0);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId, type, unreadOnly, limit]);

  // Realtime-Subscription via supabase-js (nur READ — kein Schreiben)
  useEffect(() => {
    if (!realtime) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel('admin:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchNotifications)
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [realtime, fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
    if (refreshInterval > 0) {
      const id = setInterval(fetchNotifications, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchNotifications, refreshInterval]);

  // markRead → Server-API (KEIN direktes sbUpdate)
  const markRead = useCallback(async (id: string): Promise<boolean> => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { } : {}),
        },
        body: JSON.stringify({ is_read: true }),
      });
      if (!res.ok) {
        // Rollback bei Fehler
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
        setUnreadCount(prev => prev + 1);
      }
      return res.ok;
    } catch {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
      return false;
    }
  }, []);

  // sendNotification → Server-API
  const sendNotification = useCallback(async (
    targetUserId: string,
    notifType: string,
    title: string,
    body: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/notifications', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { } : {}),
        },
        body: JSON.stringify({ user_id: targetUserId, type: notifType, title, body, metadata }),
      });
      if (res.ok) fetchNotifications();
      return res.ok;
    } catch {
      return false;
    }
  }, [fetchNotifications]);

  return {
    notifications, total, unreadCount,
    loading, error,
    refetch: fetchNotifications,
    markRead,
    sendNotification,
  };
}
