'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Badge, { statusToBadge } from '@/components/ui/Badge';
import { useTransactions } from '@/lib/hooks/useTransactions';
import { showToast } from '@/components/ui/Toast';

export default function TransactionsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');

  const { transactions, loading } = useTransactions({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    period: periodFilter !== 'all' ? Number(periodFilter) : undefined,
  });

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
  };

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    cursor: 'pointer',
  };

  const TYPE_COLORS: Record<string, string> = {
    'Buchung':        '#4ECDC4',
    'Auszahlung':     '#FF6B6B',
    'Einzahlung':     '#51CF66',
    'Impact-Beitrag': '#B197FC',
  };

  return (
    <DashboardLayout
      title="Transaktionen"
      headerActions={
        <Button variant="ghost" icon="⬇" onClick={() => showToast('Export gestartet')}>
          Export CSV
        </Button>
      }
    >
      {/* Zusammenfassung */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Gesamt',         value: `${transactions.length}`,    color: 'var(--accent)' },
          { label: 'Abgeschlossen',  value: `${transactions.filter(t => t.status === 'completed').length}`, color: 'var(--green)' },
          { label: 'Ausstehend',     value: `${transactions.filter(t => t.status === 'pending').length}`,   color: 'var(--gold)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontSize: 20, fontWeight: 600, color, fontFamily: 'Space Mono, monospace' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filter-Zeile */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <select
          style={selectStyle}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Alle Status</option>
          <option value="completed">Abgeschlossen</option>
          <option value="pending">Ausstehend</option>
          <option value="failed">Fehlgeschlagen</option>
        </select>
        <select
          style={selectStyle}
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
        >
          <option value="all">Alle Zeiträume</option>
          <option value="7">Letzte 7 Tage</option>
          <option value="30">Letzte 30 Tage</option>
          <option value="90">Letzte 90 Tage</option>
        </select>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
          {transactions.length} Ergebnisse
        </span>
      </div>

      {/* Tabelle */}
      <div style={cardStyle}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Lade…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['ID', 'User', 'Betrag', 'Typ', 'Status', 'Datum', 'Details'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>
                      {tx.id}
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      {tx.userName}
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--green)' }}>
                      €{tx.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${TYPE_COLORS[tx.type] || '#4ECDC4'}18`, color: TYPE_COLORS[tx.type] || '#4ECDC4' }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                      {statusToBadge(tx.status)}
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11 }}>
                      {tx.date}
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                      <button
                        onClick={() => showToast(`Details: ${tx.id} · €${tx.amount.toFixed(2)}`)}
                        style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}
                      >
                        👁
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
