// frontend/src/app/employee/users/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import { usePaginatedList } from '@/lib/hooks/usePaginatedList';
import PaginationControls from '@/components/ui/PaginationControls';

interface Profile {
  id: string;
  display_name?: string | null;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  is_wirker?: boolean | null;
  blocked?: boolean | null;
  is_deleted?: boolean | null;
  created_at?: string | null;
  avatar_url?: string | null;
}

export default function EmployeeUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/profiles?limit=500', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // api-response gibt { ok: true, data: { profiles, total } }
      const list = json?.data?.profiles ?? json?.profiles ?? json?.data ?? [];
      setProfiles(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = profiles.filter(p => {
    if (p.is_deleted) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.display_name ?? '').toLowerCase().includes(q) ||
      (p.username     ?? '').toLowerCase().includes(q) ||
      (p.email        ?? '').toLowerCase().includes(q)
    );
  });

  // Pagination: fix 20 pro Seite, echte Seiten-Navigation (kein "Mehr laden")
  const { pageItems: pagedFiltered, page, totalPages, goToPage, total: pagedTotal } =
    usePaginatedList(filtered, 'created_at');

  const COL: React.CSSProperties = {
    padding: '11px 16px', fontSize: 13,
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  };

  return (
    <EmployeeLayout title="User-Übersicht">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          User-Übersicht
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {filtered.length} aktive Nutzer · read-only
        </p>
      </div>

      {error && (
        <div style={{ background:'#fc818122', border:'1px solid #fc8181', borderRadius:8,
          padding:'12px 16px', marginBottom:16, color:'#fc8181', fontSize:13 }}>
          Fehler: {error}
        </div>
      )}

      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Name, Username oder E-Mail suchen…"
        style={{ width:'100%', maxWidth:360, padding:'8px 14px', marginBottom:16,
          background:'var(--bg-card)', border:'1px solid var(--border)',
          borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }}
      />

      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:12, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:'40px', textAlign:'center', color:'var(--text-secondary)', fontSize:14 }}>
            Laden…
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg-secondary)' }}>
                {['USER','E-MAIL','ROLLE','REGISTRIERT'].map(h => (
                  <th key={h} style={{ ...COL, fontWeight:600, fontSize:11,
                    textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ padding:'32px', textAlign:'center',
                  color:'var(--text-secondary)', fontSize:13 }}>Keine Nutzer gefunden</td></tr>
              ) : pagedFiltered.map(p => {
                const name = p.display_name || p.full_name || p.username || '—';
                return (
                  <tr key={p.id}>
                    <td style={COL}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={name}
                            style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                        ) : (
                          <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0,
                            background:'var(--accent)', display:'flex', alignItems:'center',
                            justifyContent:'center', fontSize:13, fontWeight:700,
                            color:'var(--text-primary)' }}>
                            {name[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                        <span style={{ fontWeight:500, color:'var(--text-primary)' }}>
                          {name}
                          {p.is_wirker && <span style={{ marginLeft:6, color:'#d69e2e' }}>★</span>}
                        </span>
                      </div>
                    </td>
                    <td style={COL}>{p.email ?? '—'}</td>
                    <td style={COL}>
                      <span style={{
                        padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                        background: p.role === 'superadmin' ? '#e53e3e22' : p.role === 'admin' ? '#dd6b2022' : '#3182ce22',
                        color:      p.role === 'superadmin' ? '#e53e3e'   : p.role === 'admin' ? '#dd6b20'   : '#3182ce',
                      }}>
                        {p.role ?? 'user'}
                      </span>
                    </td>
                    <td style={COL}>
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('de-DE') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && (
          <PaginationControls
            visibleCount={pagedFiltered.length} total={pagedTotal}
            page={page} totalPages={totalPages} onGoToPage={goToPage}
          />
        )}
      </div>
    </EmployeeLayout>
  );
}
