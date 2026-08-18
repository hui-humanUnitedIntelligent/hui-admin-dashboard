'use client';
// frontend/src/components/views/EscrowView.tsx
// SADB: Treuhand-Verwaltung — Vollseiten-Ansicht mit Sidebar (DashboardLayout).
// FIX (2026-08-18): war zuvor NUR als eigenstaendige <div> ohne DashboardLayout gerendert
// (siehe historisch app/escrow/page.tsx) -- dadurch fehlte die linke Sidebar/Navigation und
// der Klick auf "Treuhand" wirkte wie ein Sprung in ein komplett neues Fenster. Konsolidiert
// auf DashboardLayout+PageHeader (gleiches Muster wie BookingsView/PayoutsView).
// Daten kommen 1:1 live aus Supabase (orders.escrow_status/escrow_disputes) -- keine Mock-Werte.
// Sobald echte Stripe-Escrow-Bewegungen live sind, erscheinen sie hier automatisch (kein Code-Change).
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/hooks/useAuth';

interface Dispute {
  id: string;
  order_id: string | null;
  booking_id: string | null;
  dispute_type: string;
  status: string;
  seller_evidence: string | null;
  buyer_evidence: string | null;
  admin_decision: string | null;
  created_at: string;
  resolved_at: string | null;
  initiator?: { id: string; display_name: string; email: string } | null;
  admin_user?: { id: string; display_name: string } | null;
}

interface EscrowOrder {
  id: string;
  state: string;
  escrow_status: string;
  delivery_status: string;
  total_eur: number;
  buyer_confirmed_at: string | null;
  payout_requested_at: string | null;
  created_at: string;
  auto_confirm_at: string | null;
}

interface EscrowStats {
  holding: { count: number; eur: number };
  released: { count: number; eur: number };
  open_disputes: number;
}

function fmtEur(n: number) {
  return `€${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const DISPUTE_TYPE_LABEL: Record<string, string> = {
  buyer_no_confirm: 'Käufer bestätigt nicht',
  seller_no_deliver: 'Verkäufer liefert nicht',
  quality_issue: 'Qualitätsproblem',
  fraud: 'Verdacht auf Betrug',
};

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  open:             { label: 'Offen',           color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  reviewing:        { label: 'In Prüfung',      color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  resolved_seller:  { label: '✓ Für Verkäufer', color: '#16D7C5', bg: 'rgba(22,215,197,0.12)' },
  resolved_buyer:   { label: '✓ Für Käufer',    color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  escalated:        { label: 'Eskaliert',       color: '#E83A3A', bg: 'rgba(232,58,58,0.12)' },
};

export function EscrowView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;

  const [tab, setTab] = useState<'disputes' | 'holding'>('disputes');
  const [stats, setStats] = useState<EscrowStats | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [holdingOrders, setHoldingOrders] = useState<EscrowOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, disputesRes, holdingRes] = await Promise.all([
        fetch('/api/escrow?type=stats'),
        fetch('/api/escrow?type=disputes'),
        fetch('/api/escrow?type=escrow_orders'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json().then(d => d));
      if (disputesRes.ok) setDisputes(await disputesRes.json().then(d => d.disputes ?? []));
      if (holdingRes.ok) setHoldingOrders(await holdingRes.json().then(d => d.orders ?? []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolveDispute = async (disputeId: string, decision: 'resolved_seller' | 'resolved_buyer') => {
    setResolving(disputeId);
    try {
      const res = await fetch('/api/escrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispute_id: disputeId, decision, admin_note: adminNote }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdminNote('');
        setSelectedDispute(null);
        await load();
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannt'));
      }
    } finally {
      setResolving(null);
    }
  };

  const openDisputes = disputes.filter(d => d.status === 'open');
  const closedDisputes = disputes.filter(d => d.status !== 'open');

  return (
    <DashboardLayout employeeMode={role === 'employee'} title="Treuhand">
      <PageHeader
        title="🔒 Treuhand-Verwaltung"
        subtitle="Software-Treuhand: Geld bei HUI blockiert, Transfer nach Käuferbestätigung — live aus Stripe/Supabase"
        actionsRole={role === 'employee' ? 'employee' : 'admin'}
        userRole={userRole}
        actions={
          <button onClick={load} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            ↻ Refresh
          </button>
        }
      />

      {/* KPI-Kacheln */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'In Treuhand (holding)', value: fmtEur(stats.holding.eur), sub: `${stats.holding.count} Orders`, color: '#FF8A6B', bg: 'rgba(255,138,107,0.08)' },
            { label: 'Freigegeben', value: fmtEur(stats.released.eur), sub: `${stats.released.count} Orders`, color: '#16D7C5', bg: 'rgba(22,215,197,0.08)' },
            { label: 'Offene Disputes', value: String(stats.open_disputes), sub: 'Warten auf Entscheidung', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.color}30`, borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: k.color, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{k.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['disputes', 'holding'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', border: 'none', background: 'transparent',
            fontSize: 14, fontWeight: tab === t ? 700 : 500,
            color: tab === t ? '#16D7C5' : 'var(--text-secondary)',
            borderBottom: tab === t ? '2px solid #16D7C5' : '2px solid transparent',
            cursor: 'pointer', marginBottom: -1, fontFamily: 'var(--font-body)',
          }}>
            {t === 'disputes' ? `Disputes (${openDisputes.length} offen)` : `In Treuhand (${holdingOrders.length})`}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Lädt…</div>
        ) : tab === 'disputes' ? (
          <div>
            {openDisputes.length === 0 && closedDisputes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
                Keine Disputes vorhanden ✓
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...openDisputes, ...closedDisputes].map(d => {
                  const badge = STATUS_BADGE[d.status] || STATUS_BADGE.open;
                  const isOpen = d.status === 'open';
                  const isSelected = selectedDispute === d.id;
                  return (
                    <div key={d.id} style={{
                      background: 'var(--bg-tertiary)', border: `1px solid ${isOpen ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                      borderRadius: 14, padding: 16, transition: 'box-shadow 0.2s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                              background: badge.bg, color: badge.color }}>{badge.label}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {DISPUTE_TYPE_LABEL[d.dispute_type] || d.dispute_type}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            Von: <strong>{d.initiator?.display_name || '—'}</strong>
                            {d.initiator?.email ? ` (${d.initiator.email})` : ''}
                          </div>
                          {d.order_id && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Order: {d.order_id.slice(0, 8)}…</div>}
                          {d.booking_id && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Buchung: {d.booking_id.slice(0, 8)}…</div>}
                          {d.seller_evidence && (
                            <div style={{ marginTop: 8, fontSize: 13, background: 'rgba(22,215,197,0.07)',
                              borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                              📋 Verkäufer-Nachweis: {d.seller_evidence}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                            Erstellt: {fmtDate(d.created_at)}
                            {d.resolved_at ? ` · Gelöst: ${fmtDate(d.resolved_at)}` : ''}
                          </div>
                        </div>
                        {isOpen && (
                          <button onClick={() => setSelectedDispute(isSelected ? null : d.id)}
                            style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 10,
                              background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--font-body)' }}>
                            {isSelected ? 'Abbrechen' : 'Entscheiden'}
                          </button>
                        )}
                      </div>

                      {isSelected && isOpen && (
                        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <textarea
                            value={adminNote}
                            onChange={e => setAdminNote(e.target.value)}
                            placeholder="Admin-Notiz (optional)…"
                            rows={2}
                            style={{ width: '100%', resize: 'none', border: '1.5px solid var(--border)',
                              borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-body)',
                              marginBottom: 10, boxSizing: 'border-box', outline: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => resolveDispute(d.id, 'resolved_buyer')}
                              disabled={resolving === d.id}
                              style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                                background: 'rgba(139,92,246,0.15)', color: '#8B5CF6',
                                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                              Für Käufer (Erstattung)
                            </button>
                            <button
                              onClick={() => resolveDispute(d.id, 'resolved_seller')}
                              disabled={resolving === d.id}
                              style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                                background: 'rgba(22,215,197,0.15)', color: '#16D7C5',
                                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                              Für Verkäufer (Freigabe)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            {holdingOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
                Keine Orders in Treuhand ✓
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Order-ID', 'Betrag', 'Treuhand', 'Lieferung', 'Erstellt', 'Auto-Confirm', 'Antrag?'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700,
                          color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdingOrders.map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{o.id.slice(0, 8)}…</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#FF8A6B' }}>{fmtEur(o.total_eur)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                            background: 'rgba(255,138,107,0.12)', color: '#FF8A6B' }}>holding</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{o.delivery_status}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{fmtDate(o.created_at)}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {fmtDate(o.auto_confirm_at)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {o.payout_requested_at
                            ? <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>⚠️ Antrag</span>
                            : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
