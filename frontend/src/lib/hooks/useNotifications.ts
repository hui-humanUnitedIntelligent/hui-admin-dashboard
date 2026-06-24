// frontend/src/lib/hooks/useNotifications.ts
// ── HUI Admin — useNotifications Hook mit Realtime ───────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbQuery, sbCount, sbUpdate } from '../api';
import { getSessionToken } from '@/lib/session';


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
  const channelRef                        = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = {};
      if (userId)    params['user_id'] = `eq.${userId}`;
      if (type)      params['type']    = `eq.${type}`;
      if (unreadOnly) params['is_read'] = 'eq.false';

      const [rows, count, unread] = await Promise.all([
        sbQuery<AdminNotification>('notifications', params, {
          select: 'id,user_id,type,title,body,is_read,metadata,entity_id,entity_type,created_at',
          order:  'created_at.desc',
          limit,
        }),
        sbCount('notifications', params),
        sbCount('notifications', { ...params, is_read: 'eq.false' }),
      ]);
      setNotifications(rows);
      setTotal(count);
      setUnreadCount(unread);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId, type, unreadOnly, limit]);

  useEffect(() => {
    if (!realtime) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel('admin:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications'       }, fetchNotifications)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_events' }, fetchNotifications)
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

  const markRead = useCallback(async (id: string): Promise<boolean> => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    return sbUpdate('notifications', id, { is_read: true });
  }, []);

  const sendNotification = useCallback(async (
    targetUserId: string,
    type: string,
    title: string,
    body: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSessionToken()}` },
        body: JSON.stringify({ notification: { user_id: targetUserId, type, title, body, metadata, is_read: false } }),
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
    markRead, sendNotification,
  };
}
