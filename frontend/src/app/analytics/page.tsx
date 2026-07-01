'use client';
import { useRouter } from 'next/navigation';
// frontend/src/app/analytics/page.tsx
// ARCH-006.1 Analytics-Konsolidierung: Alle Kennzahlen, die bereits im Haupt-Dashboard
// existieren (User gesamt, Umsatz, Neue User/Monat, Werke/Monat, Buchungen/Monat),
// wurden ENTFERNT -- sie duplizierten Daten und nutzten teils die tote, leere
// 'payments'-Tabelle statt stripe_payments (Shadow State). Diese Seite zeigt jetzt
// nur noch die tiefergehenden demografischen Analysen, die NICHT im Dashboard sind:
// User-Zusammensetzung, Top-Städte, Mitgliedschafts-Typen. Datenquelle: profiles
// (Supabase, ueber die admin-gated /api/admin Route), keine zweite Wahrheit.

import { isSuperAdmin } from '@/lib/roles';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

// ── Types ──────────────────────────────────────────────────────────────────
interface Profile { id: string; role: string; is_wirker: boolean; is_member: boolean; created_at: string; location_label?: string; membership_type?: string; }

// ── Donut ──────────────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const r = 36, cx = 44, cy = 44, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth={12} />
        {segments.map(({ label, value, color }) => {
          const pct = value / total;
          const dash = pct * circ;
          const gap  = circ - dash;
          const el = (
            <circle key={label} cx={cx} cy={cy} r={r} fill="none"
              stroke={color} strokeWidth={12}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={700} fill="var(--text-primary)">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: 'auto', paddingLeft: 8 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isSuperAdmin(currentUser?.role)) router.replace("/dashboard");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role]);
  if (!isSuperAdmin(currentUser?.role)) return null;

  const userRole = currentUser?.role;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch('/api/admin?table=profiles&select=id,role,is_wirker,is_member,created_at,location_label,membership_type&limit=2000')
      .then(r => r.json()).catch(() => []);
    setProfiles(Array.isArray(pRes) ? pRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Computed metrics (nur das, was NICHT im Dashboard existiert) ─────────
  const p = profiles;
  const wirkerCount  = p.filter(u => u.is_wirker).length;
  const memberCount  = p.filter(u => u.is_member).length;
  const adminCount   = p.filter(u => ['admin','superadmin'].includes(u.role)).length;
  const basisCount   = p.length - wirkerCount - memberCount - adminCount;

  const locMap: Record<string,number> = {};
  p.forEach(u => { if (u.location_label) locMap[u.location_label] = (locMap[u.location_label] || 0) + 1; });
  const topLocs = Object.entries(locMap).sort((a,b) => b[1]-a[1]).slice(0, 6);

  const memMap: Record<string,number> = {};
  p.forEach(u => { if (u.membership_type) memMap[u.membership_type] = (memMap[u.membership_type] || 0) + 1; });

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <DashboardLayout
      title="Analytics"
      headerActions={
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <PageHeader
            title="Analytics"
            subtitle="Demografische Tiefenanalyse · Kern-KPIs siehe Hauptdashboard"
            actionsRole="superadmin"
            userRole={userRole}
          />
          <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', marginLeft: 4 }}>↻</button>
        </div>
      }
    >
      <div style={{
        background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 10,
        padding: '10px 14px', fontSize: 12, color: 'var(--accent)', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        ℹ️ Umsatz, User-Wachstum, Buchungen, Werk- und Projekt-Statistiken findest du jetzt live im
        <a href="/dashboard" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>Hauptdashboard</a>
        — hier nur noch demografische Tiefenanalysen (keine doppelten Karten, ARCH-006.1).
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13 }}>Lade Analytics…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="grid-2">
            {section('🧩 User-Zusammensetzung',
              <DonutChart segments={[
                { label: 'Wirker',       value: wirkerCount,  color: 'var(--purple)' },
                { label: 'Members',      value: memberCount,  color: 'var(--gold)'   },
                { label: 'Admins',       value: adminCount,   color: 'var(--red)'    },
                { label: 'Basisuser',    value: Math.max(basisCount, 0), color: 'var(--text-muted)' },
              ]} />
            )}
            {section('📍 Top Städte',
              topLocs.length === 0
                ? <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Keine Standortdaten vorhanden</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {topLocs.map(([loc, cnt]) => (
                      <div key={loc} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc}</div>
                        <div style={{ background: 'var(--accent)', height: 6, borderRadius: 3, width: Math.max((cnt / (topLocs[0]?.[1] || 1)) * 80, 6) }} />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 20, textAlign: 'right' }}>{cnt}</div>
                      </div>
                    ))}
                  </div>
            )}
          </div>

          {section('🏅 Mitgliedschafts-Typen',
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {Object.entries(memMap).length === 0
                ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Keine Daten</span>
                : Object.entries(memMap).sort((a,b) => b[1]-a[1]).map(([t, c]) => (
                  <div key={t} style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent)', fontSize: 12, color: 'var(--accent)', display: 'flex', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{t}</span>
                    <span style={{ opacity: 0.7 }}>·</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{c}</span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
