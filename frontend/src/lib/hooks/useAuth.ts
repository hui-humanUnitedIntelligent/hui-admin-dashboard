'use client';
import { useCallback } from 'react';

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
  // Synchron aus Cookie lesen — kein useEffect, kein Flash, kein Redirect-Bug
  const role = readCookieRole();

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/admin-logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    window.location.href = '/login';
  }, []);

  const clearAuth = useCallback(() => {}, []);
  const currentUser: CurrentUser | null = role ? { role } : null;

  return { role, loading: false, currentUser, logout, clearAuth };
}
