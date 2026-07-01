// frontend/src/app/analytics/page.tsx
// ARCH-006.1: Analytics zeigt die 8 Pflicht-Kuchendiagramme fuer die komplette
// App-Aktivitaet. Nutzt denselben useDashboard()-Hook / dieselbe /api/dashboard
// Route wie das Hauptdashboard -- keine zweite Berechnung, keine zweite Wahrheit,
// nur eine andere Darstellung derselben Single-Source-of-Truth-Daten. Kern-KPIs
// (Umsatz, User gesamt, Wachstum, Tabellen) bleiben exklusiv im Hauptdashboard,
// hier ausschliesslich die Verteilungs-Kuchendiagramme.
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isSuperAdmin } from '@/lib/roles';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useDashboard } from '@/lib/hooks/useDashboard';

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12, padding: 16,
};

// ── Wiederverwendbarer Donut fuer die 8 Pflicht-Kuchendiagramme ─────────────
function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const r = 34, cx = 42, cy = 42, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <svg width={84} height={84} viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth={11} />
        {segments.filter(s => s.value > 0).map(({ label, value, color }) => {
          const pct = value / total;
          const dash = pct * circ;
          const gap  = circ - dash;
          const el = (
            <circle key={label} cx={cx} cy={cy} r={r} fill="none"
              stroke={color} strokeWidth={11}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill="var(--text-primary)">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: 1 }}>
        {segments.map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: 'auto', paddingLeft: 6 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PIE_COLORS = ['#4ECDC4', '#B197FC', '#F7B731', '#FF6B6B', '#51CF66', '#5C7CFA', '#FF922B', '#20C997'];
function pieCard(icon: string, title: string, node: React.ReactNode) {
  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>{icon} {title}</div>
      {node}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isSuperAdmin(currentUser?.role)) router.replace('/dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role]);
  if (!isSuperAdmin(currentUser?.role)) return null;

  const userRole = currentUser?.role;
  const db = useDashboard(30000);

  return (
    <DashboardLayout
      title="Analytics"
      headerActions={
        <PageHeader
          title="Analytics"
          subtitle="Verteilungs-Kuchendiagramme · komplette App-Aktivität"
          actionsRole="superadmin"
          userRole={userRole}
        />
      }
    >
      <div style={{
        background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 10,
        padding: '10px 14px', fontSize: 12, color: 'var(--accent)', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        ℹ️ Umsatz, User-Wachstum, Buchungen, Werk- und Projekt-Statistiken (Zahlen) findest du im
        <a href="/dashboard" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>Hauptdashboard</a>
        — hier die vollständige Verteilungs-Analyse als Kuchendiagramme, live aus derselben Datenquelle.
      </div>

      {db.loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13 }}>Lade Analytics…</div>
      ) : (
        <>
          {/* Gruppe: User */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="grid-2">
            {pieCard('🧩', 'User-Zusammensetzung', (
              <Donut segments={[
                { label: 'Wirker',    value: db.pieData.userComposition.wirker,    color: PIE_COLORS[1] },
                { label: 'Members',   value: db.pieData.userComposition.member,    color: PIE_COLORS[2] },
                { label: 'Admins',    value: db.pieData.userComposition.admin,     color: PIE_COLORS[3] },
                { label: 'Basisuser', value: db.pieData.userComposition.basisuser, color: 'var(--text-muted)' },
              ]} />
            ))}
            {pieCard('🏅', 'Mitgliedschafts-Typen', (
              <Donut segments={[
                { label: 'Basisuser', value: db.pieData.membershipTypes.basisuser, color: 'var(--text-muted)' },
                { label: 'Talent',    value: db.pieData.membershipTypes.talent,    color: PIE_COLORS[1] },
                { label: 'Member',    value: db.pieData.membershipTypes.member,    color: PIE_COLORS[2] },
              ]} />
            ))}
          </div>

          <div style={{ marginBottom: 12 }}>
            {pieCard('📍', 'Top Städte', (
              db.pieData.topCities.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Keine Standortdaten vorhanden</div>
                : <Donut segments={db.pieData.topCities.map((c, i) => ({ label: c.label, value: c.count, color: PIE_COLORS[i % PIE_COLORS.length] }))} />
            ))}
          </div>

          {/* Gruppe: Buchungen + Zahlungen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="grid-2">
            {pieCard('📅', 'Buchungs-Verteilung', (
              <Donut segments={[
                { label: 'Werk-Buchungen',    value: db.pieData.bookingDistribution.work,    color: PIE_COLORS[0] },
                { label: 'Talent-Buchungen',  value: db.pieData.bookingDistribution.talent,  color: PIE_COLORS[1] },
                { label: 'Projekt-Buchungen', value: db.pieData.bookingDistribution.project, color: PIE_COLORS[2] },
              ]} />
            ))}
            {pieCard('💳', 'Zahlungs-Verteilung', (
              <Donut segments={[
                { label: 'Succeeded', value: db.pieData.paymentStatusDistribution.succeeded, color: PIE_COLORS[4] },
                { label: 'Pending',   value: db.pieData.paymentStatusDistribution.pending,   color: PIE_COLORS[2] },
                { label: 'Failed',    value: db.pieData.paymentStatusDistribution.failed,    color: PIE_COLORS[3] },
                { label: 'Refunded',  value: db.pieData.paymentStatusDistribution.refunded,  color: 'var(--text-muted)' },
              ]} />
            ))}
          </div>

          {/* Gruppe: Käufe + Impact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="grid-2">
            {pieCard('🛒', 'Kauf-Verteilung', (
              <Donut segments={[
                { label: 'Werk-Käufe',    value: db.pieData.purchaseDistribution.work,        color: PIE_COLORS[0] },
                { label: 'Talent-Käufe',  value: db.pieData.purchaseDistribution.talent,       color: PIE_COLORS[1] },
                { label: 'Projekt-Käufe', value: db.pieData.purchaseDistribution.project,      color: PIE_COLORS[2] },
                { label: 'Spenden',       value: db.pieData.purchaseDistribution.donation,     color: PIE_COLORS[4] },
                { label: 'Abos',          value: db.pieData.purchaseDistribution.subscription, color: PIE_COLORS[5] },
              ]} />
            ))}
            {pieCard('🌱', 'Impact-Verteilung (€)', (
              <Donut segments={[
                { label: 'aus Werken',    value: Math.round(db.pieData.impactDistribution.work),     color: PIE_COLORS[0] },
                { label: 'aus Talenten',  value: Math.round(db.pieData.impactDistribution.talent),   color: PIE_COLORS[1] },
                { label: 'aus Projekten', value: Math.round(db.pieData.impactDistribution.project),  color: PIE_COLORS[2] },
                { label: 'aus Spenden',   value: Math.round(db.pieData.impactDistribution.donation), color: PIE_COLORS[4] },
              ]} />
            ))}
          </div>

          {/* Gruppe: Ambassadors */}
          <div>
            {pieCard('🤝', 'Ambassador-Tier-Verteilung', (
              <Donut segments={[
                { label: 'Bronze', value: db.pieData.ambassadorTiers.bronze, color: '#CD7F32' },
                { label: 'Silber', value: db.pieData.ambassadorTiers.silber, color: '#C0C0C0' },
                { label: 'Gold',   value: db.pieData.ambassadorTiers.gold,   color: '#F7B731' },
                { label: 'Platin', value: db.pieData.ambassadorTiers.platin, color: '#5C7CFA' },
              ]} />
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
