// frontend/src/app/employee/dashboard/page.tsx
// ARCH-006.1 Analytics-Konsolidierung: nutzt jetzt denselben useDashboard()-Hook
// wie das SADB-Hauptdashboard (Single Source of Truth) statt einer eigenen,
// separat berechneten /api/kpis-Route. Keine zweite Wahrheit, keine doppelte
// Berechnung derselben Kennzahlen.
'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useDashboard } from '@/lib/hooks/useDashboard';

function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function fmtNum(n: number) { return n.toLocaleString('de-DE'); }

export default function EmployeeDashboard() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const db = useDashboard(30000);
  const { kpis } = db;

  const val = (v: number | undefined, fmt?: 'eur') =>
    db.loading ? '—' : fmt === 'eur' ? fmtEur(v ?? 0) : fmtNum(v ?? 0);

  const card = (icon: string, label: string, value: string, sub?: string, color = 'var(--accent)') => (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );

  const months   = db.growth.labels;
  const userData = db.growth.newUsers;
  const maxU     = Math.max(...userData.map(Number), 1);

  return (
    <EmployeeLayout title="Employee Dashboard">
      <PageHeader
        title="Dashboard"
        subtitle="Employee-Übersicht"
        actionsRole="employee"
        userRole={userRole}
      />

      <div style={{ padding: '0 0 32px' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            👋 Willkommen im Employee Portal
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Echtzeit-Übersicht · {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {card('👥', 'Nutzer Gesamt',     val(kpis.totalUsers),                          `${kpis.activeWirker} Wirker`)}
          {card('🏅', 'Aktive Mitglieder', val(kpis.activeMembers),                        `${kpis.activeBookings} Buchungen aktiv`)}
          {card('🎨', 'Werke',             val(kpis.totalWorks),                           'Veröffentlichte Werke')}
          {card('📅', 'Buchungen',         val(db.bookingStats.last30.count),              'Letzte 30 Tage')}
          {card('💳', 'Umsatz (Monat)',    val(kpis.monthlyRevenue, 'eur'),                `${kpis.totalPayments} Zahlungen gesamt`)}
          {card('🤝', 'Ambassadors aktiv', val(kpis.activeAmbassadors),                     kpis.pendingAmbassadors > 0 ? `${kpis.pendingAmbassadors} Antrag offen` : 'Keine offen')}
        </div>

        {/* Impact Pool */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {card('🌱', 'Impact Pool Netto', val(kpis.impactPool, 'eur'), '15% des Umsatzes', '#4ECDC4')}
          {card('🏢', 'Firmenanteil',      val(kpis.companyShareEur, 'eur'), '85% des Pools', '#5C7CFA')}
          {card('🌍', 'Projekt-Anteil',    val(kpis.projectShareEur, 'eur'), '15% des Pools', '#51CF66')}
        </div>

        {/* Talente / Werke / Projekte — konsolidiert aus Analytics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {card('⭐', 'Talente', val(db.talentStats.total), db.loading ? '' : `${db.talentStats.percentOfUsers}% der User`, 'var(--purple)')}
          {card('🎨', 'Werke offen', val(db.workStats.pending), 'Warten auf Freigabe', 'var(--gold)')}
          {card('📋', 'Projekt-Anträge offen', val(db.projectStats.applicationsPending), `${db.projectStats.liveCount} Projekte live`, 'var(--gold)')}
        </div>

        {/* Nutzerwachstum Chart */}
        {months.length > 0 && (
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '20px 24px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              📈 Nutzerwachstum
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
              {months.map((m, i) => (
                <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', borderRadius: 4,
                    height: `${Math.max(4, (userData[i] / maxU) * 64)}px`,
                    background: 'var(--accent)', opacity: 0.7 + (i / months.length) * 0.3,
                  }} />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
