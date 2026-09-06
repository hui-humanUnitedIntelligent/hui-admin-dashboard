// frontend/src/app/employee/dashboard/page.tsx
// ARCH-006.1 Analytics-Konsolidierung: nutzt jetzt denselben useDashboard()-Hook
// wie das SADB-Hauptdashboard (Single Source of Truth) statt einer eigenen,
// separat berechneten /api/kpis-Route. Keine zweite Wahrheit, keine doppelte
// Berechnung derselben Kennzahlen.
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useDashboard } from '@/lib/hooks/useDashboard';

// Kleines Info-Icon mit Klick-Popover — erklaert, was eine KPI-Zahl bedeutet.
// Eigene Komponente (nicht Teil von card()), da sie eigenen useState braucht.
function KpiInfoBadge({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={`Erklärung zu ${label}`}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '1px solid var(--text-muted)', background: 'transparent',
          color: 'var(--text-muted)', fontSize: 9, lineHeight: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, flexShrink: 0,
        }}
      >
        i
      </button>
      {open && (
        <div
          ref={ref}
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6,
            zIndex: 20, width: 220, maxWidth: '70vw',
            background: 'var(--bg-primary, var(--bg-secondary))',
            border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            padding: '10px 12px', fontSize: 12, lineHeight: 1.45,
            color: 'var(--text-primary)',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

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

  const card = (icon: string, label: string, value: string, sub?: string, color = 'var(--accent)', info?: string) => (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '18px 20px', position: 'relative', overflow: 'visible',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
        {info && <KpiInfoBadge label={label} text={info} />}
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
          {card('👥', 'Nutzer Gesamt',     val(kpis.totalUsers),                          `${kpis.activeWirker} Wirker`, undefined,
            "Alle registrierten Accounts aus der Nutzerverwaltung — unabhängig vom Status, inklusive gesperrter Accounts. 'Wirker' zeigt, wie viele davon aktuell als Wirker markiert sind.")}
          {card('🏅', 'Aktive Mitglieder', val(kpis.activeMembers),                        `${kpis.activeBookings} Buchungen aktiv`, undefined,
            "Nutzer mit aktiver Mitgliedschaft (is_member oder membership_active = true). 'Buchungen aktiv' zeigt Erlebnis-Buchungen der letzten 90 Tage.")}
          {card('🎨', 'Werke',             val(kpis.totalWorks),                           'Veröffentlichte Werke', undefined,
            "Anzahl veröffentlichter Werke (Status 'published'). Enthält keine Entwürfe, ausstehenden oder abgelehnten Werke.")}
          {card('📅', 'Buchungen',         val(db.bookingStats.last30.count),              'Letzte 30 Tage', undefined,
            "Anzahl aller Erlebnis-Buchungen der letzten 30 Tage, aus der bookings-Tabelle.")}
          {card('💳', 'Umsatz (Monat)',    val(kpis.monthlyRevenue, 'eur'),                `${kpis.totalPayments} Zahlungen gesamt`, undefined,
            "Summe aller erfolgreich bezahlten Bestellungen seit dem 1. dieses Monats (Single Source of Truth: stripe_payments). 'Zahlungen gesamt' ist die Gesamtzahl aller je erfolgreich abgeschlossenen Zahlungen.")}
          {card('🤝', 'Ambassadors aktiv', val(kpis.activeAmbassadors),                     kpis.pendingAmbassadors > 0 ? `${kpis.pendingAmbassadors} Antrag offen` : 'Keine offen', undefined,
            "Nutzer mit Ambassador-Status. Provisionsstufen je nach Anzahl geworbener Nutzer: Starter 5%, Bronze 10%, Silber 15%, Gold 20% — berechnet vom Unternehmensanteil (10% vom Brutto, Balanced Growth v1).")}
        </div>

        {/* Impact Pool */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {card('🌱', 'Impact Pool Netto', val(kpis.impactPool, 'eur'), '6% des Umsatzes', '#4ECDC4',
            "Von jeder Bestellung wird ein HUI-Anteil von 20% erhoben. Davon fließen 30% in den Impact Pool (= 6% vom Umsatz) für soziale Projekte — Summe für den aktuellen Kalendermonat.")}
          {card('🏢', 'Firmenanteil',      val(kpis.companyShareEur, 'eur'), '10% des Umsatzes', '#5C7CFA',
            "50% des HUI-Anteils (= 10% vom Umsatz) verbleiben beim Unternehmen (abzüglich Ambassador-Provisionen) — Summe für den aktuellen Kalendermonat.")}
          {card('🌍', 'Projekt-Anteil',    val(kpis.projectShareEur, 'eur'), '70% des Impact-Pools', '#51CF66',
            "70% des Impact-Pools (= 4,2% vom Umsatz) fließen direkt in soziale Herzensprojekte — Summe für den aktuellen Kalendermonat.")}
        </div>

        {/* Talente / Werke / Projekte — konsolidiert aus Analytics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {card('⭐', 'Talente', val(db.talentStats.total), db.loading ? '' : `${db.talentStats.percentOfUsers}% der User`, 'var(--purple)',
            "Nutzer mit aktivem Talent-Profil (is_talent = true) und ihr prozentualer Anteil an allen registrierten Nutzern.")}
          {card('🎨', 'Werke offen', val(db.workStats.pending), 'Warten auf Freigabe', 'var(--gold)',
            "Werke mit Status 'pending', die noch auf redaktionelle Freigabe warten.")}
          {card('📋', 'Projekt-Anträge offen', val(db.projectStats.applicationsPending), `${db.projectStats.liveCount} Projekte live`, 'var(--gold)',
            "Impact-Projekt-Bewerbungen mit Status 'pending'/'pending_review', die auf Prüfung warten. 'Projekte live' zeigt bereits freigegebene, laufende Projekte.")}
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
