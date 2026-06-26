'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CurrentUser {
  role: string;
  name?: string;
  email?: string;
}

export function useAuth() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const cookieRole = document.cookie
      .split('; ')
      .find(row => row.startsWith('hui_admin_role='))
      ?.split('=')[1];

    setRole(cookieRole ?? null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/admin-logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    router.push('/login');
  }, [router]);

  // Backward compat: currentUser mit role, name, email
  const currentUser: CurrentUser | null = role ? { role } : null;

  // clearAuth: legacy stub (kein localStorage mehr)
  const clearAuth = useCallback(() => {}, []);

  return { role, loading, currentUser, logout, clearAuth };
}
