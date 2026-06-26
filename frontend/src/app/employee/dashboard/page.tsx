// frontend/src/app/employee/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';

interface KPIs {
  totalUsers:    number;
  activeUsers:   number;
  totalWorks:    number;
  activeMembers: number;
  activeBookings:number;
  monthlyRevenue:number;
  impactPool:    number;
  growth: { month: string; count: number }[];
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export default function EmployeeDashboard() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const [kpis,    setKpis]    = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/kpis', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setKpis(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const val = (v: number | undefined, fmt?: 'eur') =>
    loading ? '—' : fmt === 'eur' ? fmtEur(v ?? 0) : String(v ?? 0);

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

  const months   = kpis?.growth?.map(g => g.month)  ?? [];
  const userData = kpis?.growth?.map(g => g.count)   ?? [];
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
          {card('👥', 'Nutzer Gesamt',     val(kpis?.totalUsers),                          'Registrierte Accounts')}
          {card('✅', 'Aktive Nutzer',     val(kpis?.activeUsers),                         'Aktiv in 30 Tagen')}
          {card('🎨', 'Werke',             val(kpis?.totalWorks),                          'Veröffentlichte Werke')}
          {card('📅', 'Buchungen',         val(kpis?.activeBookings),                      'Gesamt Buchungen')}
          {card('💳', 'Transaktionen',     val(kpis?.monthlyRevenue, 'eur'),               'Abgeschlossene Zahlungen')}
          {card('🏆', 'Mitgliedschaften',  val(kpis?.activeMembers),                       'Aktive Mitgliedschaften')}
        </div>

        {/* Monats-Umsatz */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {card('💰', 'Monats-Umsatz',  val(kpis?.monthlyRevenue, 'eur'), 'Umsatz im aktuellen Monat', '#51CF66')}
          {card('🌱', 'Impact Pool',    val(kpis?.impactPool, 'eur'),     '15% des Umsatzes',          '#4ECDC4')}
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
