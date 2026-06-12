// frontend/src/lib/hooks/useAuth.ts
'use client';

import { useState, useCallback } from 'react';
import api, { storeAuth, clearAuth, getStoredUser, supabaseAdminLogin, SUPABASE_URL } from '../api';

export interface AdminUser {
  id: string | number;
  name: string;
  email: string;
  role: string;
}

const DEMO_ADMIN: AdminUser = {
  id: 0,
  name: 'HUI Admin',
  email: 'admin@hui-platform.io',
  role: 'super_admin',
};

// Check if Supabase is configured
const hasSupabase = () => !!(SUPABASE_URL);

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // 1. Try Supabase Auth (live HUI app users)
      if (hasSupabase()) {
        const supaRes = await supabaseAdminLogin(email, password);
        if (supaRes?.access_token) {
          const userId = supaRes.user?.id;

          // Echte Rolle aus profiles-Tabelle lesen (nicht aus auth.users — dort steht nur "authenticated")
          let profileRole = 'admin';
          if (userId) {
            try {
              const profileRes = await fetch(
                `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role&limit=1`,
                {
                  headers: {
                    apikey:        (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
                    Authorization: `Bearer ${(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')}`,
                  },
                }
              );
              const profileData = await profileRes.json();
              if (Array.isArray(profileData) && profileData.length > 0 && profileData[0].role) {
                profileRole = profileData[0].role;
              }
            } catch {
              // Fallback: behalte 'admin'
            }
          }

          const user: AdminUser = {
            id: userId || 0,
            name: supaRes.user?.user_metadata?.full_name || supaRes.user?.email || 'Admin',
            email: supaRes.user?.email || email,
            role: profileRole,
          };
          storeAuth(supaRes.access_token, user);
          return true;
        }
      }

      // 2. Try legacy backend
      if (process.env.NEXT_PUBLIC_API_URL) {
        const { data } = await api.post('/auth/login', { email, password });
        if (data?.token) {
          storeAuth(data.token, data.admin);
          return true;
        }
      }

      // 3. Demo mode (only if no live backends configured)
      if (!hasSupabase() && !process.env.NEXT_PUBLIC_API_URL) {
        if (email === 'admin@hui-platform.io' && password === 'admin123') {
          storeAuth('demo-token-' + Date.now(), DEMO_ADMIN);
          return true;
        }
      }

      setError('Ungültige Anmeldedaten');
      return false;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (process.env.NEXT_PUBLIC_API_URL) {
        await api.post('/auth/logout').catch(() => {});
      }
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  }, []);

  const currentUser = getStoredUser() as AdminUser | null;

  return { login, logout, loading, error, currentUser };
}
