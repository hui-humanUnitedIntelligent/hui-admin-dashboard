'use client';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CurrentUser {
  role: string;
  name?: string;
  email?: string;
}

function readCookieRole(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith('hui_admin_role='));
  return match ? match.split('=')[1] : null;
}

export function useAuth() {
  // Synchron lesen — kein useEffect, kein loading-State, kein Flackern
  const role = readCookieRole();
  const loading = false;

  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/admin-logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    window.location.href = '/login';
  }, []);

  const clearAuth = useCallback(() => {}, []);

  const currentUser: CurrentUser | null = role ? { role } : null;

  return { role, loading, currentUser, logout, clearAuth };
}
