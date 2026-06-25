// frontend/src/app/employee/users/page.tsx
// READ-ONLY Employee-Ansicht: User-Liste
'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { getSessionToken } from '@/lib/session';

interface Profile {
  id: string;
  display_name?: string;
  username?: string;
  full_name?: string;
  email?: string;
  role?: string;
  score?: number;
  created_at?: string;
  is_verified?: boolean;
  deleted_at?: string | null;
}

function timeAgo(iso?: string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'Heute';
  if (d < 7)  return `${d}d`;
  if (d < 30) return `${Math.floor(d/7)}w`;
  return `${Math.floor(d/30)}mo`;
}

export default function EmployeeUsersPage() {
  const { currentUser } = useAuth();
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');

  // Guard: nur superadmin darf /users sehen
  useEffect(() => {
    if (currentUser && !isSuperAdmin(currentUser.role)) {
      router.replace('/employee');
    }
  }, [currentUser, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getSessionToken();
      const res = await fetch('/api/profiles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setProfiles(j.data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = profiles.filter(p => {
    if (!search) return !p.deleted_at;
    const q = search.toLowerCase();
    return !p.deleted_at && (
      (p.display_name || '').toLowerCase().includes(q) ||
      (p.username     || '').toLowerCase().includes(q) ||
      (p.email        || '').toLowerCase().includes(q)
    );
  });

  return (
    <EmployeeLayout title="User-Übersicht">
      <PageHeader
        title="User-Übersicht"
        subtitle={`${filtered.length} aktive Nutzer (read-only)`}
        actionsRole="employee"
      />

      {/* Suche */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Name, Username oder E-Mail suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 380, padding: '8px 12px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
          }}
        />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Laden…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Username', 'Rolle', 'Score', 'Verifiziert', 'Erstellt'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {p.display_name || p.full_name || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                    @{p.username || '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Badge variant={p.role === 'superadmin' || p.role === 'admin' ? 'warning' : 'default'}>
                      {p.role || 'basisuser'}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                    {p.score ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {p.is_verified ? '✅' : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                    {timeAgo(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Keine Nutzer gefunden.
            </div>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
