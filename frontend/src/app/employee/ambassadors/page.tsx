// frontend/src/app/employee/ambassadors/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/hooks/useAuth';

interface Ambassador {
  id:            string;
  displayName:   string;
  username:      string;
  avatarUrl:     string | null;
  email:         string | null;
  role:          string;
  isWirker:      boolean;
  trustScore:    number;
  impactEur:     number;
  createdAt:     string;
  referralCode:  string | null;
  referralLink:  string | null;
  referralCount: number;
  revenueEur:    number;
}

function fmtEur(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1000) return `€${(v / 1000).toFixed(1)}K`;
  return `€${v.toFixed(2)}`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getLevel(rev: number): { label: string; color: string; bg: string } {
  if (rev >= 5000) return { label: '\uD83E\uDD47 Gold',   color: '#ffd43b', bg: 'rgba(255,212,59,0.15)' };
  if (rev >= 1000) return { label: '\uD83E\uDD48 Silber', color: '#ced4da', bg: 'rgba(206,212,218,0.15)' };
  return                  { label: '\uD83E\uDD49 Bronze', color: '#cd7f32', bg: 'rgba(205,127,50,0.15)' };
}

export default function AmbassadorsPage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [toast,       setToast]       = useState('');
  const [acting,      setActing]      = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/ambassador?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAmbassadors(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      console.error('[ambassadors]', e);
      setAmbassadors([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function toggleAmbassador(a: Ambassador) {
    if (userRole !== 'superadmin') return;
    setActing(a.id);
    try {
      const res = await fetch('/api/ambassador', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: a.id, action: 'deactivate' }),
      });
      if (res.ok) { showToast('\u2705 Ambassador entfernt'); load(); }
      else         showToast('Fehler beim Speichern');
    } finally { setActing(null); }
  }

  const filtered = ambassadors.filter(a =>
    !search ||
    a.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (a.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.username ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = ambassadors.reduce((s, a) => s + (a.revenueEur ?? 0), 0);
  const totalRef     = ambassadors.reduce((s, a) => s + (a.referralCount ?? 0), 0);

  const colStyle: React.CSSProperties = { padding: '10px 14px' };
  const thStyle: React.CSSProperties  = { padding: '10px 14px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 600 };

  return (
    <EmployeeLayout title="Ambassadors">
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'var(--accent)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <PageHeader title="Ambassadors" subtitle="Referral-Partner & Markenbotschafter" actionsRole={userRole as "superadmin" | "employee"} userRole={userRole} />

      {/* KPI-Kacheln */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Ambassadors', val: String(ambassadors.length), icon: '\uD83E\uDD1D' },
          { label: 'Gesamtumsatz', val: fmtEur(totalRevenue), icon: '\uD83D\uDCB0' },
          { label: 'Referrals',    val: String(totalRef),     icon: '\uD83D\uDD17' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Suche */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Name, E-Mail oder Username..."
          style={{ width: '100%', maxWidth: 400, padding: '8px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* Tabelle */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Lade Ambassadors...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Keine Ambassadors gefunden.</div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                <th style={thStyle}>Ambassador</th>
                <th style={thStyle}>Level</th>
                <th style={thStyle}>Referrals</th>
                <th style={thStyle}>Umsatz</th>
                <th style={thStyle}>Ref-Link</th>
                <th style={thStyle}>Seit</th>
                {userRole === 'superadmin' && <th style={thStyle}>Aktion</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => {
                const level = getLevel(a.revenueEur ?? 0);
                return (
                  <tr key={a.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={colStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {a.avatarUrl ? (
                          <img src={a.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                            {(a.displayName?.[0] ?? '?').toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.displayName || a.username || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.email ?? a.username ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={colStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: level.bg, color: level.color }}>{level.label}</span>
                    </td>
                    <td style={{ ...colStyle, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{a.referralCount ?? 0}</td>
                    <td style={{ ...colStyle, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#51cf66' }}>{fmtEur(a.revenueEur)}</td>
                    <td style={colStyle}>
                      {a.referralLink ? (
                        <a href={a.referralLink} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 11, textDecoration: 'none' }}>
                          {a.referralCode ?? a.referralLink.split('/').pop()}
                        </a>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ ...colStyle, color: 'var(--text-muted)', fontSize: 12 }}>{fmtTime(a.createdAt)}</td>
                    {userRole === 'superadmin' && (
                      <td style={colStyle}>
                        <button
                          disabled={acting === a.id}
                          onClick={() => toggleAmbassador(a)}
                          style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: acting === a.id ? 'not-allowed' : 'pointer', opacity: acting === a.id ? 0.5 : 1 }}
                        >
                          {acting === a.id ? '...' : 'Entfernen'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </EmployeeLayout>
  );
}
