'use client';

import { useState, useCallback } from 'react';
import api, { storeAuth, clearAuth, getStoredUser } from '../api';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        // In Dummy-Modus: Demo-Login ohne echten API-Call
        if (
          process.env.NEXT_PUBLIC_ENV !== 'production' ||
          !process.env.NEXT_PUBLIC_API_URL
        ) {
          if (email === 'admin@hui-platform.io' && password === 'admin123') {
            const dummyToken = 'dummy-jwt-token-' + Date.now();
            const dummyUser: AdminUser = {
              id: 1,
              name: 'Michael Admin',
              email,
              role: 'super_admin',
            };
            storeAuth(dummyToken, dummyUser);
            return true;
          }
          setError('Ungültige Anmeldedaten');
          return false;
        }

        // Live-API-Call
        const { data } = await api.post('/auth/login', { email, password });
        storeAuth(data.token, data.admin);
        return true;
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen';
        setError(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Token löschen auch wenn API-Call fehlschlägt
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  }, []);

  const currentUser = getStoredUser() as AdminUser | null;

  return { login, logout, loading, error, currentUser };
}
