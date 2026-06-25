// frontend/src/app/employee/dashboard/page.tsx
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useKPIs, useGrowthChart } from '@/lib/hooks/useSupabase';
import { getStoredUser } from '@/lib/api';

function fmtNum(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n); }
function fmtEur(n: number) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n); }

export default function EmployeeDashboard() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const router = useRouter();
  const { totalUsers, activeMembers: activeMemberships, totalWorks, totalPayments, activeBookings, monthlyRevenue, loading } = useKPIs();
  const { labels: chartLabels, newUsers: chartNewUsers } = useGrowthChart();

  // Auth guard
  useEffect(() => {
    const user = getStoredUser();
    const mode = typeof window !== 'undefined' ? localStorage.getItem('hui_dashboard_mode') : null;
    if (!user) { router.push('/login'); return; }
    if (mode === 'super') router.push('/dashboard');
  }, [router]);

  const card = (icon: string, label: string, value: string | number, sub?: string, color = 'var(--accent)') => (
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
        {loading ? '—' : value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );

  const months = chartLabels || [];
  const userData = chartNewUsers || [];
  const maxU = Math.max(...userData.map(Number), 1);

  return (
    <EmployeeLayout title="Employee Dashboard">
      
      <PageHeader
        title="Dashboard"
        subtitle="Employee-Übersicht"
        actionsRole="employee"
        userRole={userRole}
      />

<div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Begrüßung */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
            👋 Willkommen im Employee Portal
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
            Echtzeit-Übersicht · {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* ── Zeile 1: User & Content ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
          {card('👥', 'Nutzer gesamt',    fmtNum(totalUsers || 0),        'Registrierte Accounts',     'var(--accent)')}
          {card('✅', 'Aktive Nutzer',    fmtNum(totalUsers || 0),        'Aktiv in 30 Tagen',          '#51CF66')}
          {card('🖼️', 'Werke',            fmtNum(totalWorks || 0),        'Veröffentlichte Werke',      '#74C0FC')}
        </div>

        {/* ── Zeile 2: Commerce & Finanzen ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
          {card('📅', 'Buchungen',        fmtNum(activeBookings || 0),    'Gesamt Buchungen',           '#FFD43B')}
          {card('💳', 'Transaktionen',    fmtNum(totalPayments || 0),     'Abgeschlossene Zahlungen',   '#F783AC')}
          {card('🏅', 'Mitgliedschaften', fmtNum(activeMemberships || 0), 'Aktive Mitgliedschaften',    '#CC5DE8')}
        </div>

        {/* ── Umsatz-Banner ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: 28 }}>
          {card('💰', 'Monats-Umsatz', fmtEur(monthlyRevenue || 0), 'Umsatz im aktuellen Monat', 'var(--accent)')}
        </div>

        {/* Wachstums-Chart */}
        {months.length > 0 && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>📈 Nutzerwachstum</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
              {months.map((m: string, i: number) => {
                const val = Number(userData[i] || 0);
                const h = Math.max((val / maxU) * 90, 4);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: '100%', height: h, borderRadius: '4px 4px 0 0',
                      background: 'var(--accent)', opacity: i === months.length - 1 ? 1 : 0.5,
                    }} />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </EmployeeLayout>
  );
}
