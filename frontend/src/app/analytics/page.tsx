'use client';
import { useRouter } from 'next/navigation';
// frontend/src/app/analytics/page.tsx

import { isSuperAdmin } from '@/lib/roles';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

// ── Types ──────────────────────────────────────────────────────────────────
interface Profile { id: string; role: string; is_wirker: boolean; is_member: boolean; created_at: string; location_label?: string; membership_type?: string; }
interface Payment { id: string; amount_eur?: number; created_at: string; status?: string; state?: string; }
interface Work    { id: string; status: string; created_at: string; price_eur?: number; views_count?: number; }
interface Booking { id: string; created_at: string; }

interface Analytics {
  profiles:  Profile[];
  payments:  Payment[];
  works:     Work[];
  bookings:  Booking[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function monthKey(iso: string) { return iso?.slice(0, 7) || ''; }
function fmt(n: number) { return n.toLocaleString('de-DE', { minimumFractionDigits: 0 }); }
function fmtEur(n: number) { return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }
function last6Months(): string[] {
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}
function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('de-DE', { month: 'short', year: '2-digit' });
}

// ── Mini Bar Chart ─────────────────────────────────────────────────────────
function BarChart({ data, color, label }: { data: { label: string; value: number }[]; color: string; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {data.map(({ label: l, value: v }) => (
          <div key={l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{v > 0 ? v : ''}</div>
            <div style={{ width: '100%', background: color, borderRadius: '3px 3px 0 0', height: Math.max((v / max) * 64, v > 0 ? 4 : 0), transition: 'height 0.5s ease', opacity: v === 0 ? 0.2 : 1 }} />
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '-0.2px' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

// ── KPI Card ───────────────────────────────────────────────────────────────
function KPI({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <div className="kpi-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="kpi-value" style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 5 }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
        </div>
        <span style={{ fontSize: 22, opacity: 0.6 }}>{icon}</span>
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
  const [data, setData]       = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<'6m' | '3m' | '1m'>('6m');

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, payRes, wRes, bRes] = await Promise.all([
      fetch('/api/admin?table=profiles&select=id,role,is_wirker,is_member,created_at,location_label,membership_type&limit=2000').then(r => r.json()).catch(() => []),
      fetch('/api/admin?table=payments&select=id,amount_eur,created_at,status,state&limit=2000').then(r => r.json()).catch(() => []),
      fetch('/api/admin?table=works&select=id,status,created_at,price_eur,views_count&limit=2000').then(r => r.json()).catch(() => []),
      fetch('/api/admin?table=bookings&select=id,created_at&limit=2000').then(r => r.json()).catch(() => []),
    ]);
    setData({
      profiles: Array.isArray(pRes)   ? pRes   : [],
      payments: Array.isArray(payRes) ? payRes : [],
      works:    Array.isArray(wRes)   ? wRes   : [],
      bookings: Array.isArray(bRes)   ? bRes   : [],
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const months = period === '6m' ? last6Months() : period === '3m' ? last6Months().slice(3) : last6Months().slice(5);

  // ── Computed metrics ────────────────────────────────────────────────────
  const p = data?.profiles  || [];
  const py = data?.payments || [];
  const w = data?.works     || [];

  const newUsersByMonth   = months.map(m => ({ label: monthLabel(m), value: p.filter(u => monthKey(u.created_at) === m).length }));
  const revenueByMonth    = months.map(m => ({ label: monthLabel(m), value: Math.round(py.filter(x => monthKey(x.created_at) === m && x.amount_eur).reduce((s, x) => s + (x.amount_eur || 0), 0)) }));
  const worksByMonth      = months.map(m => ({ label: monthLabel(m), value: w.filter(x => monthKey(x.created_at) === m).length }));
  const bookingsByMonth   = months.map(m => ({ label: monthLabel(m), value: (data?.bookings || []).filter(x => monthKey(x.created_at) === m).length }));

  const totalRevenue      = py.reduce((s, x) => s + (x.amount_eur || 0), 0);
  const wirkerCount       = p.filter(u => u.is_wirker).length;
  const memberCount       = p.filter(u => u.is_member).length;
  const adminCount        = p.filter(u => ['admin','superadmin'].includes(u.role)).length;
  const basisCount        = p.length - wirkerCount - memberCount - adminCount;

  // Top locations
  const locMap: Record<string,number> = {};
  p.forEach(u => { if (u.location_label) locMap[u.location_label] = (locMap[u.location_label] || 0) + 1; });
  const topLocs = Object.entries(locMap).sort((a,b) => b[1]-a[1]).slice(0, 6);

  // Membership types
  const memMap: Record<string,number> = {};
  p.forEach(u => { if (u.membership_type) memMap[u.membership_type] = (memMap[u.membership_type] || 0) + 1; });

  const tabBtn = (v: typeof period, l: string) => (
    <button
      onClick={() => setPeriod(v)}
      style={{
        padding: '5px 14px', borderRadius: 7, border: '1px solid',
        borderColor: period === v ? 'var(--accent)' : 'var(--border)',
        background: period === v ? 'var(--accent-dim)' : 'transparent',
        color: period === v ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)',
      }}
    >{l}</button>
  );

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
        subtitle="Plattform-Metriken & Trends"
        actionsRole="superadmin"
        userRole={userRole}
      />

{tabBtn('1m', '1M')} {tabBtn('3m', '3M')} {tabBtn('6m', '6M')}
          <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', marginLeft: 4 }}>↻</button>
        </div>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13 }}>Lade Analytics…</div>
      ) : (
        <>
          {/* ── KPI Row ── */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <KPI label="User gesamt"    value={fmt(p.length)}       color="var(--accent)" icon="◎" sub={`+${newUsersByMonth[newUsersByMonth.length-1]?.value || 0} diesen Monat`} />
            <KPI label="Wirker"         value={fmt(wirkerCount)}     color="var(--purple)" icon="⭐" sub={`${Math.round(wirkerCount/Math.max(p.length,1)*100)}% der User`} />
            <KPI label="Members"        value={fmt(memberCount)}     color="var(--gold)"   icon="🏅" sub={`${Math.round(memberCount/Math.max(p.length,1)*100)}% der User`} />
            <KPI label="Gesamtumsatz"   value={fmtEur(totalRevenue)} color="var(--green)"  icon="⇄" sub={`${py.length} Zahlungen`} />
          </div>

          {/* ── Charts Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="grid-2">
            {section('👥 Neue User',       <BarChart data={newUsersByMonth}  color="var(--accent)" label="User pro Monat" />)}
            {section('💶 Umsatz (€)',      <BarChart data={revenueByMonth}   color="var(--green)"  label="Umsatz pro Monat" />)}
            {section('🎨 Neue Werke',      <BarChart data={worksByMonth}     color="var(--purple)" label="Werke pro Monat" />)}
            {section('📅 Buchungen',       <BarChart data={bookingsByMonth}  color="var(--gold)"   label="Buchungen pro Monat" />)}
          </div>

          {/* ── User Composition + Locations ── */}
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

          {/* ── Membership breakdown ── */}
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
