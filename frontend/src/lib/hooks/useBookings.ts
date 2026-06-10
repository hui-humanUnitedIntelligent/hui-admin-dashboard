// frontend/src/lib/hooks/useBookings.ts
// ── HUI Admin — useBookings Hook mit Realtime ────────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbQuery, sbCount, sbUpdate } from '../api';
import type { HuiBooking } from './useSupabase';

export type { HuiBooking };

export interface UseBookingsOptions {
  status?:          string;
  days?:            number;
  limit?:           number;
  refreshInterval?: number;
  realtime?:        boolean;
}

export function useBookings(opts: UseBookingsOptions = {}) {
  const { status, days, limit = 50, refreshInterval = 0, realtime = true } = opts;
  const [bookings, setBookings] = useState<HuiBooking[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const channelRef              = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = {};
      if (status && status !== 'all') params['status'] = `eq.${status}`;
      if (days) {
        const since = new Date(Date.now() - days * 86400000).toISOString();
        params['created_at'] = `gte.${since}`;
      }
      const [rows, count] = await Promise.all([
        sbQuery<HuiBooking>('bookings', params, { select: '*', order: 'created_at.desc', limit }),
        sbCount('bookings', params),
      ]);
      setBookings(rows); setTotal(count);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, days, limit]);

  useEffect(() => {
    if (!realtime) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel('admin:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [realtime, fetchBookings]);

  useEffect(() => {
    fetchBookings();
    if (refreshInterval > 0) {
      const id = setInterval(fetchBookings, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchBookings, refreshInterval]);

  const updateBookingStatus = useCallback(async (id: string, newStatus: string): Promise<boolean> => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    const ok = await sbUpdate('bookings', id, { status: newStatus });
    if (!ok) fetchBookings();
    return ok;
  }, [fetchBookings]);

  return { bookings, total, loading, error, refetch: fetchBookings, updateBookingStatus };
}
