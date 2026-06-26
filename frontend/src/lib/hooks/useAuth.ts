'use client';
import { useEffect, useState } from 'react';

export function useAuth() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cookieRole = document.cookie
      .split('; ')
      .find(row => row.startsWith('hui_admin_role='))
      ?.split('=')[1];

    setRole(cookieRole ?? null);
    setLoading(false);
  }, []);

  return { role, loading };
}
