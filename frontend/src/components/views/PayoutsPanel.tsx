'use client';
// frontend/src/components/views/PayoutsPanel.tsx
// SADB+EDB: Auszahlungen — Kern-Logik (KPIs, Tabs, Tabelle, Aktionen, Bankdaten-Modal).
// Layout-frei, damit es an zwei Stellen wiederverwendet werden kann ohne Duplikation:
//  1) PayoutsView.tsx -- Vollseiten-Ansicht (/payouts SADB, /employee/payouts EDB)
//  2) ambassadors/page.tsx -- als eingebettetes Fenster (Modal) direkt im Ambassador-Bereich,
//     ausgelöst durch Klick auf eine der 3 Auszahlungsanfragen-Kacheln (Michael, 2026-07-04:
//     "nicht als neuen side drawer sondern intern im ambassador bereich").
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

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
  approved:  '#74c0fc',
  pending:   '#74c0fc',
  paid:      '#51cf66',
  rejected:  '#ff8787',
  failed:    '#ff6b6b',
};
const STATUS_LABEL: Record<string, string> = {
  requested: 'Offen',
  approved:  'Genehmigt',
  pending:   'Ausstehend',
  paid:      'Ausgezahlt',
  rejected:  'Abgelehnt',
  failed:    'Fehlgeschlagen',
};
function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] || '#868e96';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
      background: `${c}22`, color: c, border: `1px solid ${c}44`, whiteSpace: 'nowrap' }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

const TABS = [
  { id: 'all',       label: 'Alle' },
  { id: 'requested', label: '⏳ Offen' },
  { id: 'approved',  label: '👍 Genehmigt' },
  { id: 'paid',      label: '✅ Ausgezahlt' },
  { id: 'rejected',  label: '🚫 Abgelehnt' },
  { id: 'failed',    label: '❌ Fehlgeschlagen' },
] as const;

type TabId = typeof TABS[number]['id'];

const REFRESH_INTERVAL_MS = 15000; // Live-Update-Ersatz (Dashboard nutzt Cookie-Auth statt Supabase-Auth-Session, daher kein postgres_changes-Realtime moeglich)

export function PayoutsPanel({ role, initialStatus, onClose }: {
  role: 'superadmin' | 'employee';
  /** Vorausgewählter Status-Tab, z.B. wenn von einer Kachel geöffnet ('requested'/'approved'/'paid') */
  initialStatus?: TabId;
  /** Wenn gesetzt: Panel zeigt einen kompakten Titel+Schließen-Header (Modal-Modus) statt
   *  sich auf eine umgebende PageHeader/DashboardLayout zu verlassen (Vollseiten-Modus). */
  onClose?: () => void;
}) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const isSuperadmin = role === 'superadmin';
  const [tab,     setTab]     = useState<TabId>(initialStatus ?? 'all');
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');
  const [totals,  setTotals]  = useState({ total: 0, paid: 0, pending: 0, failed: 0 });
  const [busyId,  setBusyId]  = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ ok: boolean; msg: string } | null>(null);
  // AMB-BANK-PAYOUT-001: entschlüsselte Bankdaten -- nur superadmin, nur temporär im State,
  // wird beim Schließen des Modals sofort verworfen (kein Caching).
  const [bankModal, setBankModal] = useState<{ payoutId: string; iban: string; holder: string; bic: string | null; bankName: string | null; amountEur: number } | null>(null);
  const [bankLoading, setBankLoading] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (status?: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const q = status && status !== 'all' ? `&status=${status}` : '';
      const res  = await fetch(`/api/stripe?type=payouts${q}&limit=100`, { credentials: 'include' });
      const data = await res.json();
      const rows = Array.isArray(data.data) ? data.data : [];
      setPayouts(rows);
      setTotals({
        total:   rows.reduce((s: number, r: any) => s + (r.amount_eur ?? 0), 0),
        paid:    rows.filter((r: any) => r.status === 'paid').reduce((s: number, r: any) => s + (r.amount_eur ?? 0), 0),
        pending: rows.filter((r: any) => ['requested','pending','approved'].includes(r.status)).reduce((s: number, r: any) => s + (r.amount_eur ?? 0), 0),
        failed:  rows.filter((r: any) => r.status === 'failed').length,
      });
    } catch { /* noop */ } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { load(tab === 'all' ? undefined : tab); }, [tab, load]);

  // Auto-Refresh (Ersatz fuer echtes Realtime, siehe Kommentar oben)
  useEffect(() => {
    pollRef.current = setInterval(() => load(tab === 'all' ? undefined : tab, true), REFRESH_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, load]);

  const runAction = async (action: string, payload: Record<string, any>, successMsg: string) => {
    setBusyId(payload.payout_id);
    try {
      const res = await fetch('/api/stripe', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (data?.ok) {
        setToast({ ok: true, msg: successMsg });
        await load(tab === 'all' ? undefined : tab);
      } else {
        setToast({ ok: false, msg: `Fehler: ${data?.error || 'unbekannt'}` });
      }
    } catch (e: any) {
      setToast({ ok: false, msg: `Fehler: ${e?.message || 'Netzwerkfehler'}` });
    } finally {
      setBusyId(null);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleApprove = (id: string) => runAction('approve_payout', { payout_id: id }, 'Anfrage genehmigt');
  const handleReject = (id: string) => {
    const reason = window.prompt('Grund der Ablehnung (optional):') ?? '';
    runAction('reject_payout', { payout_id: id, reason }, 'Anfrage abgelehnt');
  };
  const handleExecute = (id: string) => {
    if (!window.confirm('Echte Stripe-Auszahlung jetzt starten? Dies überweist Geld an den Ambassador.')) return;
    runAction('execute_payout', { payout_id: id }, 'Auszahlung über Stripe gestartet');
  };

  // AMB-BANK-PAYOUT-001: einfacherer Weg ohne Stripe-Connect -- Bankdaten ansehen + manuell
  // überweisen, dann hier bestätigen. Beide nur für Superadmin (Server prüft das zusätzlich).
  const handleViewBank = async (id: string, amountEur: number) => {
    setBankLoading(id);
    try {
      const res = await fetch('/api/stripe', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_payout_bank_details', payout_id: id }),
      });
      const data = await res.json();
      if (data?.ok) {
        setBankModal({ payoutId: id, iban: data.iban, holder: data.holder, bic: data.bic, bankName: data.bank_name, amountEur });
      } else {
        setToast({ ok: false, msg: `Fehler: ${data?.error || 'unbekannt'}` });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e: any) {
      setToast({ ok: false, msg: `Fehler: ${e?.message || 'Netzwerkfehler'}` });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBankLoading(null);
    }
  };

  const handleMarkPaid = (id: string) => {
    if (!window.confirm('Wurde der Betrag bereits per Banküberweisung an den Ambassador gesendet? Dies markiert die Auszahlung als erledigt und kann nicht rückgängig gemacht werden.')) return;
    runAction('mark_payout_paid', { payout_id: id }, 'Als überwiesen markiert');
  };

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
  const btnBase: React.CSSProperties = {
    padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
  };

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Kompakter Header nur im Modal-Modus (Vollseiten-Modus bekommt PageHeader von PayoutsView) */}
        {onClose ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>💸 Auszahlungen</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Ambassador-Provisionen · Auszahlungsstatus · Fehler
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Ambassador suchen…"
                style={{ padding: '8px 14px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: 200 }} />
              <button onClick={onClose} aria-label="Schließen" style={{
                width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer',
                fontSize: 14, lineHeight: 1, flexShrink: 0,
              }}>✕</button>
            </div>
          </div>
        ) : (
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ambassador suchen…"
            style={{ padding: '8px 14px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: 220, alignSelf: 'flex-end' }} />
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: toast.ok ? '#51cf6622' : '#ff6b6b22',
            border: `1px solid ${toast.ok ? '#51cf66' : '#ff6b6b'}44`,
            color: toast.ok ? '#51cf66' : '#ff6b6b',
          }}>{toast.msg}</div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {[
            { label: 'Gesamt beantragt', val: eur(totals.total), color: '#635BFF' },
            { label: 'Ausgezahlt',       val: eur(totals.paid),  color: '#51cf66' },
            { label: 'Offen/Genehmigt',  val: eur(totals.pending),color: '#ffd43b' },
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
                {['Ambassador','E-Mail','Betrag','Provisionen','Zeitraum','Bankdaten','Status','Stripe-ID','Angefordert','Abgeschlossen','Fehler/Grund','Aktion'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={12} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>
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
                  <td style={{ ...td, fontSize: 11 }}>
                    {p.commission_count ?? 0}
                    {p.soonest_expiry && (
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        Fenster bis {fmtDate(p.soonest_expiry).slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {p.period_start ? fmtDate(p.period_start).slice(0, 10) : '—'}
                    {p.period_end ? ` – ${fmtDate(p.period_end).slice(0, 10)}` : ''}
                  </td>
                  <td style={td}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: p.has_bank_details ? 'rgba(81,207,102,0.12)' : 'rgba(255,135,135,0.12)',
                      color: p.has_bank_details ? '#51cf66' : '#ff8787',
                    }}>
                      {p.has_bank_details ? `🏦 •••• ${p.bank_iban_last4 || ''}` : '❌ Keine Bankdaten'}
                    </span>
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
                    title={p.failed_reason || p.rejected_reason || ''}>
                    {p.failed_reason || p.rejected_reason || '—'}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {p.status === 'requested' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button disabled={busyId === p.id} onClick={() => handleApprove(p.id)}
                          style={{ ...btnBase, background: '#51cf66', color: '#000' }}>
                          {busyId === p.id ? '…' : '✓ Genehmigen'}
                        </button>
                        <button disabled={busyId === p.id} onClick={() => handleReject(p.id)}
                          style={{ ...btnBase, background: 'transparent', border: '1px solid #ff8787', color: '#ff8787' }}>
                          ✕ Ablehnen
                        </button>
                      </div>
                    )}
                    {p.status === 'approved' && (
                      isSuperadmin ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button disabled={bankLoading === p.id} onClick={() => handleViewBank(p.id, p.amount_eur)}
                            style={{ ...btnBase, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                            {bankLoading === p.id ? '…' : '🏦 Bankdaten ansehen'}
                          </button>
                          <button disabled={busyId === p.id} onClick={() => handleMarkPaid(p.id)}
                            style={{ ...btnBase, background: '#51cf66', color: '#000' }}>
                            {busyId === p.id ? '…' : '✅ Als überwiesen markieren'}
                          </button>
                          <button disabled={busyId === p.id} onClick={() => handleReject(p.id)}
                            style={{ ...btnBase, background: 'transparent', border: '1px solid #ff8787', color: '#ff8787' }}>
                            ✕ Ablehnen
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Wird von Superadmin bearbeitet</span>
                      )
                    )}
                    {['paid','rejected','failed'].includes(p.status) && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={12} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  Keine Auszahlungen für diesen Status
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AMB-BANK-PAYOUT-001: Klartext-Bankdaten -- nur temporär, verschwindet beim Schließen */}
      {bankModal && (
        <div onClick={() => setBankModal(null)} style={{
          position: 'fixed', inset: 0, zIndex: 10020,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 420,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '22px 24px', boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🏦 Bankdaten für Überweisung</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              Nur zur manuellen Überweisung sichtbar — dieser Zugriff wird protokolliert.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Angeforderter Betrag</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#51cf66', fontFamily: 'var(--font-mono)' }}>{eur(bankModal.amountEur)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Kontoinhaber</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{bankModal.holder || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>IBAN</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>{bankModal.iban}</div>
              </div>
              {bankModal.bic && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>BIC</div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{bankModal.bic}</div>
                </div>
              )}
              {bankModal.bankName && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Name und Anschrift der Bank</div>
                  <div style={{ fontSize: 13 }}>{bankModal.bankName}</div>
                </div>
              )}
            </div>
            <button onClick={() => setBankModal(null)} style={{
              marginTop: 20, width: '100%', padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>Schließen</button>
          </div>
        </div>
      )}
    </>
  );
}
