// frontend/src/app/transactions/page.tsx
'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { statusToBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { usePayments, HuiPayment } from '@/lib/hooks/useSupabase';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `vor ${h} Std`;
  return new Date(iso).toLocaleDateString('de-DE');
}

function Skeleton() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: `${40 + (i * 10) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function TransactionsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<HuiPayment | null>(null);
  const LIMIT = 50;

  const { payments, total, loading, refetch } = usePayments({
    status: statusFilter,
    days: daysFilter,
    page,
    limit: LIMIT,
    refreshInterval: 30000,
  });

  // Stats
  const totalEur    = payments.reduce((s, p) => s + (p.amount_eur || 0), 0);
  const totalImpact = payments.reduce((s, p) => s + (p.impact_amount || 0), 0);
  const completed   = payments.filter((p) => p.status === 'completed').length;

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  });

  return (
    <DashboardLayout
      title="Transaktionen & Zahlungen"
      headerActions={
        <button
          onClick={refetch}
          style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          ↻ Live Refresh
        </button>
      }
    >
      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }} className="grid-4">
        {[
          { label: 'Geladen',    value: loading ? '…' : total.toString(),                  color: 'var(--accent)',  icon: '📊' },
          { label: 'Volumen',    value: loading ? '…' : `€${totalEur.toFixed(0)}`,          color: 'var(--gold)',    icon: '€' },
          { label: 'Impact',     value: loading ? '…' : `€${totalImpact.toFixed(0)}`,       color: 'var(--green)',   icon: '🌱' },
          { label: 'Completed',  value: loading ? '…' : `${completed} / ${payments.length}`,color: 'var(--purple)',  icon: '✓' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all','completed','pending','failed'].map((s) => (
            <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => { setStatusFilter(s); setPage(0); }}>
              {s === 'all' ? 'Alle' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: 'Alles', val: undefined },
            { label: '7 Tage', val: 7 },
            { label: '30 Tage', val: 30 },
            { label: '90 Tage', val: 90 },
          ].map(({ label, val }) => (
            <button key={label} style={filterBtnStyle(daysFilter === val)} onClick={() => { setDaysFilter(val); setPage(0); }}>
              {label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {total} Zahlungen insgesamt
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['ID', 'Betrag', 'Impact', 'Status', 'Währung', 'Buchung', 'Datum'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    Keine Zahlungen gefunden
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr
                    key={p.id}
                    className="tr-hover"
                    onClick={() => setSelected(p === selected ? null : p)}
                    style={{ background: selected?.id === p.id ? 'var(--accent-dim)' : 'transparent' }}
                  >
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>
                      {p.id.slice(0, 8)}…
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>
                      €{(p.amount_eur || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      €{(p.impact_amount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      {statusToBadge(p.status)}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                      {p.currency || 'eur'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 10, borderBottom: '1px solid var(--border)' }}>
                      {p.booking_id ? p.booking_id.slice(0, 6) + '…' : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      {timeAgo(p.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded detail */}
        {selected && (
          <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {[
                ['Volle ID',     selected.id],
                ['Zahler ID',    selected.payer_id || '—'],
                ['Empfänger ID', selected.recipient_id || '—'],
                ['Buchungs-ID',  selected.booking_id || '—'],
                ['Betrag',       `€${(selected.amount_eur || 0).toFixed(2)}`],
                ['Impact Anteil',`€${(selected.impact_amount || 0).toFixed(2)}`],
                ['Status',       selected.status],
                ['Erstellt',     new Date(selected.created_at).toLocaleString('de-DE')],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{k}</div>
                  <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-all' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} von {total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', opacity: page === 0 ? 0.4 : 1 }}>
                ← Zurück
              </button>
              <button onClick={() => setPage(page + 1)} disabled={(page + 1) * LIMIT >= total}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', cursor: (page + 1) * LIMIT >= total ? 'not-allowed' : 'pointer', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', opacity: (page + 1) * LIMIT >= total ? 0.4 : 1 }}>
                Weiter →
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
