'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { DUMMY_USERS, DummyUser } from '../dummy/data';

const IS_DUMMY = process.env.NEXT_PUBLIC_ENV !== 'production';

export function useUsers() {
  const [users, setUsers] = useState<DummyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (IS_DUMMY) {
        await new Promise((r) => setTimeout(r, 300));
        setUsers(DUMMY_USERS);
      } else {
        const { data } = await api.get('/users');
        setUsers(data);
      }
    } catch {
      setError('Fehler beim Laden der User');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const updateStatus = useCallback(
    async (id: number, status: 'active' | 'suspended') => {
      if (IS_DUMMY) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status } : u))
        );
        return;
      }
      await api.patch(`/users/${id}/status`, { status });
      await fetchUsers();
    },
    [fetchUsers]
  );

  const deleteUser = useCallback(
    async (id: number) => {
      if (IS_DUMMY) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        return;
      }
      await api.delete(`/users/${id}`);
      await fetchUsers();
    },
    [fetchUsers]
  );

  return { users, loading, error, fetchUsers, updateStatus, deleteUser };
}
