'use client';
// frontend/src/app/system/WebhookMapping.tsx
// HUI Stripe Webhook-Mapping — vollständige Referenz (ARCH-006.1)
import { useState, useEffect, useCallback } from 'react';

interface WebhookLog {
  id: string;
  stripe_event_id: string;
  event_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

const MAPPING = [
  {
    event:   'payment_intent.succeeded',
    icon:    '✅',
    color:   '#51cf66',
    rpc:     'rpc_record_payment',
    table:   'stripe_payments',
    actions: [
      'Zahlung status = "succeeded"',
      'Impact Pool +15% (stripe_impact_pool)',
      'Ambassador-Provision +5% (stripe_ambassador_commissions)',
      'profiles.first_transaction_at gesetzt',
      'SADB: stripe_payments live',
      'EDB: ambassador_commissions aktualisiert',
      'App: Zahlungsstatus → success',
    ],
    systems: ['Supabase', 'SADB', 'EDB', 'App'],
  },
  {
    event:   'payment_intent.payment_failed',
    icon:    '❌',
    color:   '#ff6b6b',
    rpc:     'rpc_record_payment',
    table:   'stripe_payments',
    actions: [
      'Zahlung status = "failed"',
      'stripe_webhooks Fehler-Log',
      'SADB: Fehlerlog sichtbar',
      'App: Fehlermeldung anzeigen',
    ],
    systems: ['Supabase', 'SADB', 'App'],
  },
  {
    event:   'charge.refunded',
    icon:    '↩️',
    color:   '#74c0fc',
    rpc:     'rpc_handle_refund',
    table:   'stripe_payments',
    actions: [
      'Zahlung status = "refunded"',
      'Impact Pool korrigiert (−Betrag)',
      'Ambassador-Provision → status = "refunded"',
      'SADB/EDB synchronisiert',
    ],
    systems: ['Supabase', 'SADB', 'EDB'],
  },
  {
    event:   'customer.subscription.created',
    icon:    '🔄',
    color:   '#a78bfa',
    rpc:     'rpc_record_subscription',
    table:   'stripe_subscriptions',
    actions: [
      'Abo angelegt / aktiviert',
      'User zugeordnet via stripe_customers',
      'App: Abo-Status aktiv',
      'SADB/EDB: Abo sichtbar',
    ],
    systems: ['Supabase', 'SADB', 'EDB', 'App'],
  },
  {
    event:   'customer.subscription.updated',
    icon:    '✏️',
    color:   '#a78bfa',
    rpc:     'rpc_record_subscription',
    table:   'stripe_subscriptions',
    actions: [
      'Abo-Status aktualisiert',
      'Laufzeit / Betrag angepasst',
      'SADB/EDB synchronisiert',
    ],
    systems: ['Supabase', 'SADB', 'EDB'],
  },
  {
    event:   'customer.subscription.deleted',
    icon:    '🚫',
    color:   '#868e96',
    rpc:     'rpc_record_subscription',
    table:   'stripe_subscriptions',
    actions: [
      'Abo status = "canceled"',
      'App: Abo deaktiviert',
      'SADB/EDB synchronisiert',
    ],
    systems: ['Supabase', 'SADB', 'EDB', 'App'],
  },
  {
    event:   'payout.paid',
    icon:    '📤',
    color:   '#ffd43b',
    rpc:     'rpc_record_payout',
    table:   'stripe_payouts',
    actions: [
      'Auszahlung status = "paid"',
      'Ambassador-Commissions → status = "paid" (wenn match)',
      'EDB: Auszahlungsstatus aktualisiert',
      'SADB synchronisiert',
    ],
    systems: ['Supabase', 'SADB', 'EDB'],
  },
  {
    event:   'payout.failed',
    icon:    '⚠️',
    color:   '#ff6b6b',
    rpc:     'rpc_record_payout',
    table:   'stripe_payouts',
    actions: [
      'Auszahlung status = "failed"',
      'SADB Fehler-Log sichtbar',
      'EDB: Fehlerstatus angezeigt',
    ],
    systems: ['Supabase', 'SADB', 'EDB'],
  },
];

const SYSTEM_COLORS: Record<string, string> = {
  Supabase: '#3ECF8E',
  SADB:     '#F59E0B',
  EDB:      '#EF4444',
  App:      '#6C63FF',
  Webseite: '#10B981',
};

function SystemBadge({ sys }: { sys: string }) {
  const c = SYSTEM_COLORS[sys] || '#868e96';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: `${c}22`, border: `1px solid ${c}55`, color: c,
    }}>{sys}</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    processed: '#51cf66', ok: '#51cf66',
    failed: '#ff6b6b', error: '#ff6b6b',
    received: '#ffd43b', processing: '#ffd43b',
  };
  const c = map[status] || '#868e96';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: `${c}22`, color: c,
    }}>{status}</span>
  );
}

export default function WebhookMapping() {
  const [selected,  setSelected]  = useState<string | null>(null);
  const [logs,      setLogs]      = useState<WebhookLog[]>([]);
  const [logLoad,   setLogLoad]   = useState(false);
  const [tab,       setTab]       = useState<'map' | 'logs'>('map');
  const [filterEvt, setFilterEvt] = useState('');

  const loadLogs = useCallback(async () => {
    setLogLoad(true);
    try {
      const res = await fetch('/api/stripe?type=webhooks', { credentials: 'include' });
      const d   = await res.json();
      setLogs(Array.isArray(d.data) ? d.data : []);
    } catch { /* noop */ } finally { setLogLoad(false); }
  }, []);

  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab, loadLogs]);

  const filteredLogs = filterEvt
    ? logs.filter(l => l.event_type.includes(filterEvt))
    : logs;

  const errorCount = logs.filter(l => l.status === 'failed').length;
  const okCount    = logs.filter(l => l.status === 'processed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
            📡 Stripe Webhook Mapping
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            8 Events · 5 RPCs · 5 Tabellen · 4 Systeme synchronisiert — Single Source of Truth: Supabase
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: '8 Events',   color: '#635BFF' },
            { label: '5 RPCs',     color: '#3ECF8E' },
            { label: '5 Tabellen', color: '#F59E0B' },
            { label: '0 Shadow States', color: '#51cf66' },
          ].map(k => (
            <div key={k.label} style={{
              padding: '6px 14px', borderRadius: 20,
              background: `${k.color}18`, border: `1px solid ${k.color}44`,
              fontSize: 11, fontWeight: 700, color: k.color,
            }}>{k.label}</div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {([['map','📋 Mapping'],['logs','📜 Live-Logs']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '8px 18px', borderRadius: 8,
            border: '1px solid var(--border)', cursor: 'pointer',
            background: tab === id ? 'var(--accent)' : 'var(--bg-secondary)',
            color:       tab === id ? '#fff' : 'var(--text-muted)',
            fontSize: 13, fontWeight: 600,
          }}>{label}{id==='logs' && errorCount > 0 ? ` ⚠️${errorCount}` : ''}</button>
        ))}
      </div>

      {/* ── TAB: MAPPING ── */}
      {tab === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MAPPING.map((m) => {
            const isOpen = selected === m.event;
            return (
              <div key={m.event}
                style={{
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${isOpen ? m.color + '66' : 'var(--border)'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: isOpen ? `0 0 20px ${m.color}22` : 'none',
                  transition: 'all .2s',
                }}>

                {/* Header-Row */}
                <button
                  onClick={() => setSelected(isOpen ? null : m.event)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 20px', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <code style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.event}</code>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      → {m.rpc} → {m.table}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {m.systems.map(s => <SystemBadge key={s} sys={s} />)}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0, marginLeft: 8 }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>

                {/* Detail */}
                {isOpen && (
                  <div style={{
                    borderTop: `1px solid ${m.color}33`,
                    padding: '16px 20px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 16,
                  }}>
                    {/* Event */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                        Stripe Event
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ padding: '8px 12px', background: `${m.color}18`,
                          border: `1px solid ${m.color}44`, borderRadius: 8 }}>
                          <code style={{ fontSize: 12, color: m.color, fontWeight: 700 }}>{m.event}</code>
                        </div>
                        <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)', borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>→ RPC</div>
                          <code style={{ fontSize: 11, color: '#3ECF8E', fontWeight: 700 }}>{m.rpc}</code>
                        </div>
                        <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)', borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>→ Tabelle</div>
                          <code style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>{m.table}</code>
                        </div>
                      </div>
                    </div>

                    {/* Aktionen */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                        Systemaktionen
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {m.actions.map((a, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 6,
                            fontSize: 11, color: 'var(--text-primary)',
                          }}>
                            <span style={{ color: m.color, flexShrink: 0, marginTop: 1 }}>→</span>
                            {a}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Synchronisation */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                        Synchronisierte Systeme
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(['Supabase','SADB','EDB','App','Webseite'] as const).map(s => {
                          const synced = m.systems.includes(s);
                          const sc     = SYSTEM_COLORS[s];
                          return (
                            <div key={s} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 10px', borderRadius: 8,
                              background: synced ? `${sc}18` : 'var(--bg-tertiary)',
                              border: `1px solid ${synced ? sc+'44' : 'var(--border)'}`,
                              opacity: synced ? 1 : 0.4,
                            }}>
                              <span style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: synced ? sc : '#555', flexShrink: 0,
                                boxShadow: synced ? `0 0 6px ${sc}` : 'none',
                              }} />
                              <span style={{ fontSize: 12, fontWeight: 600,
                                color: synced ? sc : 'var(--text-muted)' }}>{s}</span>
                              {synced && (
                                <span style={{ fontSize: 10, color: sc, marginLeft: 'auto' }}>✅</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: LOGS ── */}
      {tab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Live KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Events gesamt', val: logs.length,  color: '#635BFF' },
              { label: 'Verarbeitet',   val: okCount,       color: '#51cf66' },
              { label: 'Fehler',        val: errorCount,    color: '#ff6b6b' },
              { label: 'Ausstehend',    val: logs.filter(l => l.status==='received').length, color: '#ffd43b' },
            ].map(k => (
              <div key={k.label} style={{
                background: 'var(--bg-secondary)', border: `1px solid ${k.color}44`,
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4,
                  textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color,
                  fontFamily: 'var(--font-mono)' }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Filter + Refresh */}
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={filterEvt}
              onChange={e => setFilterEvt(e.target.value)}
              placeholder="Event filtern (z.B. payment_intent)"
              style={{
                flex: 1, maxWidth: 360, padding: '8px 14px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
              }}
            />
            <button onClick={loadLogs} style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 12,
            }}>🔄 Aktualisieren</button>
          </div>

          {/* Log-Tabelle */}
          {logLoad ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lade Logs…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Event-ID','Typ','Status','Fehler','Empfangen','Verarbeitet'].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left', fontSize: 10,
                        textTransform: 'uppercase', letterSpacing: '0.6px',
                        color: 'var(--text-muted)', fontWeight: 600,
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-tertiary)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 11 }}>
                        <code style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {log.stripe_event_id?.slice(0, 22)}…
                        </code>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <code style={{ fontSize: 11, color: '#635BFF', fontWeight: 700 }}>
                          {log.event_type}
                        </code>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <StatusBadge status={log.status} />
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#ff6b6b',
                        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={log.error_message || ''}>
                        {log.error_message ? log.error_message.slice(0, 40) + '…' : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)',
                        whiteSpace: 'nowrap' }}>
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString('de-DE', {
                              day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit',
                            })
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)',
                        whiteSpace: 'nowrap' }}>
                        {log.processed_at
                          ? new Date(log.processed_at).toLocaleString('de-DE', {
                              day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{
                        padding: '40px', textAlign: 'center',
                        color: 'var(--text-muted)', fontSize: 13,
                      }}>
                        {logs.length === 0 ? 'Noch keine Webhook-Events empfangen' : 'Keine Treffer für diesen Filter'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
