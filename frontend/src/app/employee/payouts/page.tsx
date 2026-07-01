'use client';
// frontend/src/app/employee/payouts/page.tsx
// EDB: Auszahlungen — alle Ambassador-Payouts, Status, Fehler
import { useState, useEffect, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';

function eur(val: number | null | undefined) {
  return `€${((val ?? 0)).toFixed(2)}`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_COLOR: Record<string, string> = {
  requested: '#ffd43b',
  pending:   '#74c0fc',
  paid:      '#51cf66',
  failed:    '#ff6b6b',
};
function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] || '#868e96';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
      background: `${c}22`, color: c, border: `1px solid ${c}44`, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

const TABS = [
  { id: 'all',       label: 'Alle' },
  { id: 'requested', label: '⏳ Angefordert' },
  { id: 'pending',   label: '🔄 Ausstehend' },
  { id: 'paid',      label: '✅ Ausgezahlt' },
  { id: 'failed',    label: '❌ Fehlgeschlagen' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function EmployeePayoutsPage() {
  const [tab,     setTab]     = useState<TabId>('all');
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');
  const [totals,  setTotals]  = useState({ total: 0, paid: 0, pending: 0, failed: 0 });

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const q = status && status !== 'all' ? `&status=${status}` : '';
      const res  = await fetch(`/api/stripe?type=payouts${q}&limit=100`, { credentials: 'include' });
      const data = await res.json();
      const rows = Array.isArray(data.data) ? data.data : [];
      setPayouts(rows);
      setTotals({
        total:   rows.reduce((s: number, r: any) => s + (r.amount_eur ?? 0), 0),
        paid:    rows.filter((r: any) => r.status === 'paid').reduce((s: number, r: any) => s + (r.amount_eur ?? 0), 0),
        pending: rows.filter((r: any) => ['requested','pending'].includes(r.status)).reduce((s: number, r: any) => s + (r.amount_eur ?? 0), 0),
        failed:  rows.filter((r: any) => r.status === 'failed').length,
      });
    } catch { /* noop */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(tab === 'all' ? undefined : tab); }, [tab, load]);

  const filtered = search
    ? payouts.filter(p => p.username?.toLowerCase().includes(search.toLowerCase())
        || p.display_name?.toLowerCase().includes(search.toLowerCase()))
    : payouts;

  const th: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '0.6px',
    color: 'var(--text-muted)', fontWeight: 600,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-tertiary)', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border)',
  };

  return (
    <EmployeeLayout title="Auszahlungen">
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>💸 Auszahlungen</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Ambassador-Provisionen · Auszahlungsstatus · Fehler
            </p>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ambassador suchen…"
            style={{ padding: '8px 14px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: 220 }} />
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {[
            { label: 'Gesamt beantragt', val: eur(totals.total), color: '#635BFF' },
            { label: 'Ausgezahlt',       val: eur(totals.paid),  color: '#51cf66' },
            { label: 'Ausstehend',       val: eur(totals.pending),color: '#ffd43b' },
            { label: 'Fehlgeschlagen',   val: String(totals.failed), color: '#ff6b6b' },
          ].map(k => (
            <div key={k.label} style={{
              background: 'var(--bg-secondary)', border: `1px solid ${k.color}44`,
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color,
                fontFamily: 'var(--font-mono)' }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Status-Tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border)',
              background: tab === t.id ? (STATUS_COLOR[t.id] || 'var(--accent)') : 'var(--bg-secondary)',
              color:       tab === t.id ? '#fff' : 'var(--text-muted)',
            }}>{t.label}</button>
          ))}
          <button onClick={() => load(tab === 'all' ? undefined : tab)} style={{
            padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-secondary)', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 12, marginLeft: 'auto',
          }}>🔄</button>
        </div>

        {/* Tabelle */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Ambassador','E-Mail','Betrag','Status','Stripe-ID','Angefordert','Abgeschlossen','Fehler'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Lade…
                </td></tr>
              )}
              {!loading && filtered.map((p: any) => (
                <tr key={p.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>@{p.username || '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.display_name || ''}</div>
                  </td>
                  <td style={{ ...td, fontSize: 11, color: 'var(--text-muted)' }}>{p.email || '—'}</td>
                  <td style={{ ...td, fontWeight: 700, color: '#51cf66', fontFamily: 'var(--font-mono)' }}>
                    {eur(p.amount_eur)}
                  </td>
                  <td style={td}><StatusBadge status={p.status} /></td>
                  <td style={{ ...td, fontSize: 10 }}>
                    {p.stripe_payout_id
                      ? <code style={{ color: 'var(--text-muted)' }}>{p.stripe_payout_id.slice(0, 18)}…</code>
                      : '—'}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)' }}>
                    {fmtDate(p.requested_at)}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)' }}>
                    {fmtDate(p.processed_at)}
                  </td>
                  <td style={{ ...td, fontSize: 11, color: '#ff6b6b', maxWidth: 200,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={p.failed_reason || ''}>
                    {p.failed_reason || '—'}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  Keine Auszahlungen für diesen Status
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </EmployeeLayout>
  );
}
