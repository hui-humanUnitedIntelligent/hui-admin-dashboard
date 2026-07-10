// frontend/src/components/views/TransactionsView.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { statusToBadge } from '@/components/ui/Badge';
import { usePayments, HuiTransaction } from '@/lib/hooks/useSupabase';
import PaginationControls from '@/components/ui/PaginationControls';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `vor ${h} Std`;
  return new Date(iso).toLocaleDateString('de-DE');
}

const CATEGORY_LABEL: Record<string, string> = {
  payment: 'Zahlung', refund: 'Refund', subscription: 'Abo',
  commission: 'Provision', payout: 'Auszahlung',
  work: 'Werk', talent: 'Talent', project: 'Projekt', donation: 'Spende', one_time: 'Einmalig',
};

/** Extrahiert das Impact-Zielprojekt aus dem Metadaten-Objekt einer Transaktion.
 *  Die Impact-Engine schreibt in metadata.impact_distribution.distributions ein
 *  Array mit { project_name, amount_eur, share_pct }.  P1 (Index 0) ist der
 *  Top-Empfänger (50 % Anteil) — dieser wird in der Tabellen-Spalte gezeigt. */
function getImpactProject(t: HuiTransaction): string | null {
  const dists = (t.metadata as Record<string, unknown> | null)?.impact_distribution as
    { distributions?: { project_name?: string }[] } | undefined;
  const p1 = dists?.distributions?.[0]?.project_name;
  if (p1) return p1;
  // Fallback: generisches project_title-Feld (falls von RPC gesetzt)
  if (t.project_title) return t.project_title;
  return null;
}

function recordTypeBadge(t: HuiTransaction) {
  const label = t.record_type === 'payment' ? (CATEGORY_LABEL[t.category] || t.category) : CATEGORY_LABEL[t.record_type];
  const color =
    t.record_type === 'refund' ? 'var(--red, #e05252)' :
    t.record_type === 'commission' ? 'var(--purple)' :
    t.record_type === 'payout' ? 'var(--gold)' :
    t.record_type === 'subscription' ? 'var(--accent)' : 'var(--text-secondary)';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: `${color}18`, color }}>
      {label}
    </span>
  );
}

function Skeleton() {
  return (
    <tr>
      {[...Array(10)].map((_, i) => (
        <td key={i} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: `${40 + (i * 10) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

const STATUS_FILTERS = ['all', 'completed', 'pending', 'failed', 'refund', 'subscription'];
const CATEGORY_FILTERS = ['work', 'talent', 'project', 'donation'];

const TABLE_HEADERS = ['ID', 'Typ', 'Betrag', 'Impact-Anteil', 'Projekt', 'Status', 'Währung', 'Nutzer', 'Ambassador', 'Datum'];

export function TransactionsView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const [statusFilter, setStatusFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<HuiTransaction | null>(null);
  const LIMIT = 20;

  const { payments, total, totalVolume, totalImpact, completed, loading, refetch } = usePayments({
    status: statusFilter,
    days: daysFilter,
    page,
    limit: LIMIT,
    refreshInterval: 0,
  });

  // Sortiert nach Datum (neueste zuerst), unabhaengig von RPC-interner Reihenfolge.
  // Server liefert bereits fix 20 pro Seite (LIMIT) -- keine weitere Client-Unterteilung.
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  });

  const statusLabel: Record<string, string> = {
    all: 'Alle', completed: 'Completed', pending: 'Pending', failed: 'Failed',
    refund: 'Refunds', subscription: 'Abos',
    work: 'Werke', talent: 'Talente', project: 'Projekte', donation: 'Spenden',
  };

  const tdBase: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid var(--border)' };

  return (
    <DashboardLayout
      employeeMode={role === 'employee'}
      title="Transaktionen & Zahlungen"
    >
      <PageHeader
        title="Transaktionen"
        subtitle={role === 'employee' ? 'Zahlungs-Übersicht' : 'Alle Zahlungen & Buchungen'}
        actionsRole={role === 'employee' ? 'employee' : 'admin'}
        userRole={userRole}
        actions={
          <button
            onClick={refetch}
            style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ↻ Live Refresh
          </button>
        }
      />

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }} className="grid-4">
        {[
          { label: 'Geladen',    value: loading ? '…' : total.toString(),                       color: 'var(--accent)', icon: '📊' },
          { label: 'Volumen',    value: loading ? '…' : `€${totalVolume.toFixed(2)}`,            color: 'var(--gold)',   icon: '€' },
          { label: 'Impact',     value: loading ? '…' : `€${totalImpact.toFixed(2)}`,             color: 'var(--green)',  icon: '🌱' },
          { label: 'Completed',  value: loading ? '…' : `${completed} / ${payments.length}`,     color: 'var(--purple)', icon: '✓' },
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((s) => (
            <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => { setStatusFilter(s); setPage(0); }}>
              {statusLabel[s]}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORY_FILTERS.map((s) => (
            <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => { setStatusFilter(s); setPage(0); }}>
              {statusLabel[s]}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
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
                {TABLE_HEADERS.map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></>
              ) : sortedPayments.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_HEADERS.length} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    Keine Zahlungen gefunden
                  </td>
                </tr>
              ) : (
                sortedPayments.map((p) => {
                  const impactProject = getImpactProject(p);
                  return (
                    <tr
                      key={p.row_id}
                      className="tr-hover"
                      onClick={() => setSelected(p === selected ? null : p)}
                      style={{ background: selected?.row_id === p.row_id ? 'var(--accent-dim)' : 'transparent', cursor: 'pointer' }}
                    >
                      <td style={{ ...tdBase, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                        {p.row_id.slice(0, 10)}…
                      </td>
                      <td style={tdBase}>
                        {recordTypeBadge(p)}
                      </td>
                      <td style={{ ...tdBase, color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>
                        €{(p.amount || 0).toFixed(2)}
                      </td>
                      {/* Impact-Anteil — aus stripe_payments.impact_fee_eur (RPC-Feld: impact_share) */}
                      <td style={{ ...tdBase, color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {p.impact_share != null ? `€${p.impact_share.toFixed(2)}` : '—'}
                      </td>
                      {/* Projekt — welchem Impact-Projekt wurde dieser Anteil zugewiesen (P1 / 50 %) */}
                      <td style={{ ...tdBase, color: 'var(--text-secondary)', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={impactProject ?? undefined}>
                        {impactProject ?? '—'}
                      </td>
                      <td style={tdBase}>
                        {statusToBadge(p.status)}
                      </td>
                      <td style={{ ...tdBase, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' }}>
                        {p.currency || 'eur'}
                      </td>
                      <td style={{ ...tdBase, color: 'var(--text-secondary)', fontSize: 11 }}>
                        {p.user_name || p.user_username || '—'}
                      </td>
                      <td style={{ ...tdBase, color: 'var(--text-secondary)', fontSize: 11 }}>
                        {p.ambassador_name || p.ambassador_username || '—'}
                      </td>
                      <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: 11 }}>
                        {timeAgo(p.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded detail — alle Pflichtfelder gemäß ARCH-006.1 */}
        {selected && (
          <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {[
                ['Stripe Payment Intent ID', selected.stripe_payment_intent_id || selected.row_id],
                ['Stripe Charge ID',         selected.stripe_charge_id || '—'],
                ['Betrag',                   `€${(selected.amount || 0).toFixed(2)}`],
                ['Währung',                  (selected.currency || 'eur').toUpperCase()],
                ['Status',                   selected.status],
                ['Buchungstyp',              CATEGORY_LABEL[selected.category] || selected.category],
                ['Nutzer',                   selected.user_name || selected.user_username || selected.user_id || '—'],
                ['Nutzer E-Mail',            selected.user_email || '—'],
                ['Ambassador',               selected.ambassador_name || selected.ambassador_username || '—'],
                ['Werk-ID',                  selected.work_id || '—'],
                ['Werk-Titel',               selected.work_title || '—'],
                ['Talent-ID',                selected.talent_id || '—'],
                ['Projekt-ID',               selected.project_id || '—'],
                ['Projekt-Titel',            selected.project_title || '—'],
                ['Impact-Anteil (Pool)',      selected.impact_share != null ? `€${selected.impact_share.toFixed(2)}` : '—'],
                ['Impact P1 (50%)',           ((selected.metadata as any)?.impact_distribution?.distributions?.[0]?.amount_eur != null) ? `€${Number((selected.metadata as any).impact_distribution.distributions[0].amount_eur).toFixed(2)} → ${(selected.metadata as any).impact_distribution.distributions[0].project_name ?? ''}` : '—'],
                ['Impact P2 (30%)',           ((selected.metadata as any)?.impact_distribution?.distributions?.[1]?.amount_eur != null) ? `€${Number((selected.metadata as any).impact_distribution.distributions[1].amount_eur).toFixed(2)} → ${(selected.metadata as any).impact_distribution.distributions[1].project_name ?? ''}` : '—'],
                ['Impact P3 (20%)',           ((selected.metadata as any)?.impact_distribution?.distributions?.[2]?.amount_eur != null) ? `€${Number((selected.metadata as any).impact_distribution.distributions[2].amount_eur).toFixed(2)} → ${(selected.metadata as any).impact_distribution.distributions[2].project_name ?? ''}` : '—'],
                ['Provision',                selected.commission_amount != null ? `€${selected.commission_amount.toFixed(2)}` : '—'],
                ['Beschreibung',             selected.description || '—'],
                ['Erstellt',                 new Date(selected.created_at).toLocaleString('de-DE')],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{k}</div>
                  <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-all' }}>{v}</div>
                </div>
              ))}
              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>Metadaten</div>
                  <pre style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, overflowX: 'auto' }}>
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pagination — Server-seitig, fix 20 pro Seite */}
        <PaginationControls
          visibleCount={sortedPayments.length} total={total}
          page={page + 1} totalPages={totalPages} onGoToPage={p => setPage(p - 1)}
        />
      </div>
    </DashboardLayout>
  );
}
