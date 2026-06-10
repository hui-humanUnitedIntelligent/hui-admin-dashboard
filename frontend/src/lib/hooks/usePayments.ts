// frontend/src/lib/hooks/usePayments.ts
// ── HUI Admin — usePayments Hook mit Realtime ────────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { sbQuery, sbCount } from '../api';
import type { HuiPayment } from './useSupabase';

export type { HuiPayment };

export interface UsePaymentsOptions {
  status?:          string;
  days?:            number;
  limit?:           number;
  refreshInterval?: number;
  realtime?:        boolean;
}

export interface UsePaymentsReturn {
  payments:        HuiPayment[];
  total:           number;
  totalRevenue:    number;
  totalImpact:     number;
  loading:         boolean;
  error:           string | null;
  refetch:         () => void;
}

export function usePayments(opts: UsePaymentsOptions = {}): UsePaymentsReturn {
  const { status, days = 90, limit = 100, refreshInterval = 0, realtime = true } = opts;
  const [payments,     setPayments]     = useState<HuiPayment[]>([]);
  const [total,        setTotal]        = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalImpact,  setTotalImpact]  = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const channelRef                      = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = {};
      if (status && status !== 'all') params['status'] = `eq.${status}`;
      if (days) {
        const since = new Date(Date.now() - days * 86400000).toISOString();
        params['created_at'] = `gte.${since}`;
      }
      const [rows, count] = await Promise.all([
        sbQuery<HuiPayment>('payments', params, {
          select: 'id,payer_id,recipient_id,amount_eur,impact_amount,status,currency,created_at,booking_id',
          order: 'created_at.desc',
          limit,
        }),
        sbCount('payments', params),
      ]);
      setPayments(rows);
      setTotal(count);
      setTotalRevenue(rows.reduce((s, p) => s + (p.amount_eur || 0), 0));
      setTotalImpact(rows.reduce((s, p) => s + (p.impact_amount || 0), 0));
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
      .channel('admin:payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchPayments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders'   }, fetchPayments)
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [realtime, fetchPayments]);

  useEffect(() => {
    fetchPayments();
    if (refreshInterval > 0) {
      const id = setInterval(fetchPayments, refreshInterval);
      return () => clearInterval(id);
    }
  }, [fetchPayments, refreshInterval]);

  return { payments, total, totalRevenue, totalImpact, loading, error, refetch: fetchPayments };
}
