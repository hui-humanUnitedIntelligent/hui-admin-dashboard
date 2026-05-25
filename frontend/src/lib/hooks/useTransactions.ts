'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { DUMMY_TRANSACTIONS, DummyTransaction } from '../dummy/data';

const IS_DUMMY = process.env.NEXT_PUBLIC_ENV !== 'production';

export interface TxFilters {
  status?: string;
  period?: number; // days
}

export function useTransactions(filters?: TxFilters) {
  const [transactions, setTransactions] = useState<DummyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (IS_DUMMY) {
        await new Promise((r) => setTimeout(r, 250));
        let data = [...DUMMY_TRANSACTIONS];
        if (filters?.status && filters.status !== 'all') {
          data = data.filter((t) => t.status === filters.status);
        }
        if (filters?.period) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - filters.period);
          data = data.filter((t) => {
            const [d, m, y] = t.date.split('.');
            const date = new Date(+y, +m - 1, +d);
            return date >= cutoff;
          });
        }
        setTransactions(data);
      } else {
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.period) params.set('period', String(filters.period));
        const { data } = await api.get(`/transactions?${params}`);
        setTransactions(data);
      }
    } catch {
      setError('Fehler beim Laden der Transaktionen');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.period]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions };
}
