// frontend/src/app/employee/ambassadors/page.tsx
'use client';

import {{ useState, useEffect, useCallback }} from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import {{ useAuth }} from '@/lib/hooks/useAuth';

/* ── Typen ── */
interface Ambassador {{
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
}}

/* ── Hilfsfunktionen ── */
function fmtEur(n: number | null | undefined) {{
  const v = n ?? 0;
  return v >= 1000 ? `€${{(v / 1000).toFixed(1)}}K` : `€${{v.toFixed(2)}}`;
}}
function fmtTime(iso: string | null | undefined) {{
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {{
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }});
}}
function getLevel(revenueEur: number): {{ label: string; color: string; bg: string }} {{
  if (revenueEur >= 5000) return {{ label: '🥇 Gold',   color: '#ffd43b', bg: 'rgba(255,212,59,0.15)' }};
  if (revenueEur >= 1000) return {{ label: '🥈 Silber', color: '#ced4da', bg: 'rgba(206,212,218,0.15)' }};
  return                         {{ label: '🥉 Bronze', color: '#cd7f32', bg: 'rgba(205,127,50,0.15)' }};
}}

/* ── Komponente ── */
export default function AmbassadorsPage() {{
  const {{ currentUser }} = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [toast,       setToast]       = useState('');
  const [acting,      setActing]      = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {{
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }}, []);

  const load = useCallback(async () => {{
    setLoading(true);
    try {{
      const q = search ? `&search=${{encodeURIComponent(search)}}` : '';
      const res = await fetch(`/api/ambassador?limit=200${{q}}`, {{
        credentials: 'include',
      }});
      if (!res.ok) throw new Error(`HTTP ${{res.status}}`);
      const data = await res.json();
      setAmbassadors(Array.isArray(data.data) ? data.data : []);
    }} catch (e) {{
      console.error('[ambassadors]', e);
      setAmbassadors([]);
    }} finally {{
      setLoading(false);
    }}
  }}, [search]);

  useEffect(() => {{ load(); }}, [load]);

  async function toggleAmbassador(a: Ambassador) {{
    if (userRole !== 'superadmin') return;
    setActing(a.id);
    try {{
      const action = a.id ? 'deactivate' : 'activate'; // immer deactivate wenn schon ambassador
      const res = await fetch('/api/ambassador', {{
        method: 'PATCH',
        credentials: 'include',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify({{ user_id: a.id, action: 'deactivate' }}),
      }});
      if (res.ok) {{ showToast('✅ Gespeichert'); load(); }}
      else         showToast('Fehler beim Speichern');
    }} finally {{ setActing(null); }}
  }

  async function activateNew(userId: string) {{
    if (userRole !== 'superadmin') return;
    setActing(userId);
    try {{
      const res = await fetch('/api/ambassador', {{
        method: 'PATCH',
        credentials: 'include',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify({{ user_id: userId, action: 'activate' }}),
      }});
      if (res.ok) {{ showToast('✅ Ambassador aktiviert'); load(); }}
      else         showToast('Fehler beim Aktivieren');
    }} finally {{ setActing(null); }}
  }

  /* ── Render ── */
  const filtered = ambassadors.filter(a =>
    !search ||
    a.displayName.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase()) ||
    a.username?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = ambassadors.reduce((s, a) => s + (a.revenueEur ?? 0), 0);
  const totalRef     = ambassadors.reduce((s, a) => s + (a.referralCount ?? 0), 0);

  return (
    <EmployeeLayout title="Ambassadors">
      {{toast && (
        <div style={{{{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: 'var(--accent)', color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        }}}}>{{toast}}</div>
      )}}

      <PageHeader
        title="Ambassadors"
        subtitle="Referral-Partner & Markenbotschafter"
        actionsRole={{userRole}}
        userRole={{userRole}}
      />

      {{/* KPI-Kacheln */}}
      <div style={{{{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}}}>
        {{[
          {{ label: 'Ambassadors', val: String(ambassadors.length), icon: '🤝' }},
          {{ label: 'Gesamtumsatz', val: fmtEur(totalRevenue), icon: '💰' }},
          {{ label: 'Referrals',   val: String(totalRef), icon: '🔗' }},
        ].map(k => (
          <div key={{k.label}} style={{{{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}}}>
            <div style={{{{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}}}>
              {{k.icon}} {{k.label}}
            </div>
            <div style={{{{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}}}>
              {{k.val}}
            </div>
          </div>
        ))}}
      </div>

      {{/* Suche */}}
      <div style={{{{ marginBottom: 16 }}}}>
        <input
          value={{search}}
          onChange={{e => setSearch(e.target.value)}}
          placeholder="Name, E-Mail oder Username suchen…"
          style={{{{
            width: '100%', maxWidth: 400, padding: '8px 14px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
          }}}}
        />
      </div>

      {{/* Tabelle */}}
      {{loading ? (
        <div style={{{{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}}}>Lade…</div>
      ) : filtered.length === 0 ? (
        <div style={{{{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}}}>Keine Ambassadors gefunden.</div>
      ) : (
        <div style={{{{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}}}>
          <table style={{{{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}}}>
            <thead>
              <tr style={{{{ borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}}}>
                {{['Ambassador', 'Level', 'Referrals', 'Umsatz', 'Ref-Link', 'Seit', ...(userRole === 'superadmin' ? ['Aktion'] : [])].map(h => (
                  <th key={{h}} style={{{{ padding: '10px 14px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 600 }}}}>{{h}}</th>
                ))}}
              </tr>
            </thead>
            <tbody>
              {{filtered.map((a, idx) => {{
                const level = getLevel(a.revenueEur ?? 0);
                return (
                  <tr key={{a.id}} style={{{{ borderBottom: idx < filtered.length-1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}}}>
                    {{/* Avatar + Name */}}
                    <td style={{{{ padding: '10px 14px' }}}}>
                      <div style={{{{ display: 'flex', alignItems: 'center', gap: 10 }}}}>
                        {{a.avatarUrl ? (
                          <img src={{a.avatarUrl}} alt="" style={{{{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}}} />
                        ) : (
                          <div style={{{{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}}}>
                            {{(a.displayName?.[0] ?? '?').toUpperCase()}}
                          </div>
                        )}}
                        <div>
                          <div style={{{{ fontWeight: 600, color: 'var(--text-primary)' }}}}>{{a.displayName || a.username || '—'}}</div>
                          <div style={{{{ fontSize: 11, color: 'var(--text-muted)' }}}}>{{a.email ?? a.username ?? '—'}}</div>
                        </div>
                      </div>
                    </td>
                    {{/* Level */}}
                    <td style={{{{ padding: '10px 14px' }}}}>
                      <span style={{{{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: level.bg, color: level.color }}}}>
                        {{level.label}}
                      </span>
                    </td>
                    {{/* Referrals */}}
                    <td style={{{{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}}}>
                      {{a.referralCount ?? 0}}
                    </td>
                    {{/* Umsatz */}}
                    <td style={{{{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green, #51cf66)' }}}}>
                      {{fmtEur(a.revenueEur)}}
                    </td>
                    {{/* Ref-Link */}}
                    <td style={{{{ padding: '10px 14px' }}}}>
                      {{a.referralLink ? (
                        <a href={{a.referralLink}} target="_blank" rel="noreferrer"
                           style={{{{ color: 'var(--accent)', fontSize: 11, textDecoration: 'none' }}}}>
                          {{a.referralCode ?? a.referralLink.split('/').pop()}}
                        </a>
                      ) : <span style={{{{ color: 'var(--text-muted)', fontSize: 11 }}}}>—</span>}}
                    </td>
                    {{/* Seit */}}
                    <td style={{{{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}}}>
                      {{fmtTime(a.createdAt)}}
                    </td>
                    {{/* Aktion — nur Superadmin */}}
                    {{userRole === 'superadmin' && (
                      <td style={{{{ padding: '10px 14px' }}}}>
                        <button
                          disabled={{acting === a.id}}
                          onClick={{() => toggleAmbassador(a)}}
                          style={{{{
                            padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                            cursor: acting === a.id ? 'not-allowed' : 'pointer',
                            opacity: acting === a.id ? 0.5 : 1,
                          }}}}
                        >
                          {{acting === a.id ? '…' : 'Entfernen'}}
                        </button>
                      </td>
                    )}}
                  </tr>
                );
              }})}}
            </tbody>
          </table>
        </div>
      )}}
    </EmployeeLayout>
  );
}}
