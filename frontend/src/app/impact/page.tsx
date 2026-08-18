// frontend/src/app/impact/page.tsx
// Impact Pool — Stripe-ready Dashboard
'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';

/* ── Typen ──────────────────────────────────────────────────────────────── */
interface PoolOverview {
  totalRevenue: number;
  bruttoPool: number;      // Impact-Pool: 6% vom Umsatz (30% des HUI-Anteils)
  nettoImpact: number;     // Projekt-Anteil: 4,2% vom Umsatz (70% des Impact-Pools) -> Top-3 Herzensprojekte
  firmenanteil: number;    // Unternehmensanteil: 10% vom Umsatz (50% des HUI-Anteils)
  innovationFund: number;  // Innovationsfonds: 4% vom Umsatz (20% des HUI-Anteils)
  flexPool: number;        // Flex-Ruecklage: 1,8% vom Umsatz (30% des Impact-Pools)
  distributed: number;
  openImpact: number;
  revenueByType: { work: number; talent: number; donation: number; subscription: number; impact_subscription: number };
  paymentCount: number;
  applications: { total: number; approved: number; pending: number };
  poolState: string;
  poolMonth: string | null;
  monthly: { month: string; revenue: number; impact: number; count: number }[];
  stripeReady: boolean;
}

interface Application {
  id: string;
  project_name: string;
  short_desc: string | null;
  funding_goal: number | null;
  contact_name: string | null;
  contact_email: string | null;
  location: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string;
  reviewed_at: string | null;
  admin_comment: string | null;
  rejection_reason: string | null;
  applicant: { display_name?: string; username?: string; avatar_url?: string } | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function eur(n: number | null | undefined) {
  return `\u20ac${(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number, total: number) {
  if (!total) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const KACHEL_STYLE: React.CSSProperties = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12,
  padding: '18px 20px', flex: '1 1 160px', minWidth: 140,
};

function InfoIcon({ info }: { info: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 15, height: 15, borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          fontSize: 9, fontWeight: 700, fontStyle: 'normal', letterSpacing: 0, textTransform: 'none',
          cursor: 'pointer', border: '1px solid var(--border)', padding: 0, lineHeight: 1 }}>
        i
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute', top: '130%', left: 0, zIndex: 41, width: 220,
            background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '10px 12px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.5,
            textTransform: 'none', letterSpacing: 0, whiteSpace: 'normal' }}>
            {info}
          </div>
        </>
      )}
    </span>
  );
}

function Kachel({ label, value, sub, color, stripe, info, valueSize }: {
  label: string; value: string; sub?: string; color?: string; stripe?: boolean; info?: string; valueSize?: number;
}) {
  return (
    <div style={{ ...KACHEL_STYLE, borderTop: color ? `3px solid ${color}` : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: 0, display: 'flex', alignItems: 'center', gap: 5, flex: '1 1 auto', minWidth: 0 }}>
          {label}
          {info && <InfoIcon info={info} />}
        </p>
        {stripe && (
          <span style={{ flexShrink: 0, fontSize: 9, padding: '2px 6px', lineHeight: 1.4,
            borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818CF8', fontWeight: 600, whiteSpace: 'nowrap' }}>
            STRIPE READY
          </span>
        )}
      </div>
      <p style={{ fontSize: valueSize ?? 24, fontWeight: 700, color: color || 'var(--text-primary)', margin: 0 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  submitted:  { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B',  label: 'Eingereicht' },
  approved:   { bg: 'rgba(34,197,94,0.12)',   color: '#22C55E',  label: 'Genehmigt'   },
  rejected:   { bg: 'rgba(255,107,107,0.12)', color: 'var(--red)', label: 'Abgelehnt' },
  pending:    { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B',  label: 'Ausstehend'  },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { bg: 'rgba(148,163,184,0.12)', color: 'var(--text-muted)', label: status };
  return (
    <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

/* ── Hauptkomponente ─────────────────────────────────────────────────────── */
export default function ImpactPage() {
  const [overview,  setOverview]  = useState<PoolOverview | null>(null);
  const [apps,      setApps]      = useState<Application[]>([]);
  const [tab,       setTab]       = useState<'overview' | 'applications' | 'payments'>('overview');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [actionId,  setActionId]  = useState<string | null>(null);
  const [comment,   setComment]   = useState('');
  const [modal,     setModal]     = useState<Application | null>(null);

  const loadOverview = useCallback(async () => {
    const res = await fetch('/api/impact?type=overview', { credentials: 'include', cache: 'no-store' });
    if (res.ok) { const d = await res.json(); if (d.ok) setOverview(d); }
  }, []);

  const loadApps = useCallback(async (status = 'all') => {
    const res = await fetch(`/api/impact?type=applications&status=${status}&limit=200`, {
      credentials: 'include', cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setApps(d.applications ?? []); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadOverview(), loadApps(appFilter)]);
    setLoading(false);
  }, [loadOverview, loadApps, appFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const body: Record<string, string> = { id, action };
    if (action === 'reject' && comment) body.rejection_reason = comment;
    if (action === 'approve' && comment) body.admin_comment = comment;
    setActionId(id);
    const res = await fetch('/api/impact', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setActionId(null);
    if (d.ok) {
      showToast(action === 'approve' ? 'Bewerbung genehmigt!' : 'Bewerbung abgelehnt.', action === 'approve' ? 'success' : 'info');
      setModal(null); setComment(''); await loadApps(appFilter); await loadOverview();
    } else {
      showToast('Fehler: ' + (d.error || 'Unbekannt'), 'error');
    }
  };

  const filteredApps = apps.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [a.project_name, a.contact_name, a.location, a.short_desc]
      .some(v => (v || '').toLowerCase().includes(q));
  });

  const o = overview;
  // Balanced Growth v1 (Regel aus dem Archiv / rpc_process_order_fees):
  // Umsatz 100% -> Talent/Verkaeufer 80% + HUI-Anteil 20%.
  // HUI-Anteil 20% splittet in: Unternehmen 10% + Impact-Pool 6% + Innovationsfonds 4%.
  // Impact-Pool 6% splittet weiter in: Projekte 4,2% (70%) + Flex-Ruecklage 1,8% (30%).
  const HUI_RATE        = 0.20;
  const COMPANY_RATE    = 0.10;
  const IMPACT_RATE     = 0.06;
  const PROJECT_RATE    = 0.042;
  const FLEX_RATE       = 0.018;
  const INNOVATION_RATE = 0.04;

  return (
    <DashboardLayout title="Impact Pool">
      <div style={{ padding: '24px 28px', maxWidth: 1300, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Impact Pool</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {(HUI_RATE * 100).toFixed(0)}% jedes Umsatzes gehen an HUI (Balanced Growth v1) — davon {(COMPANY_RATE*100).toFixed(0)}% Unternehmen, {(IMPACT_RATE*100).toFixed(0)}% Impact-Pool und {(INNOVATION_RATE*100).toFixed(0)}% Innovationsfonds
              {o?.stripeReady && (
                <span style={{ marginLeft: 10, padding: '2px 8px', borderRadius: 4, fontSize: 11,
                  background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>
                  ✓ Stripe verbunden — Live-Daten
                </span>
              )}
            </p>
          </div>
          <button onClick={load} disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
            {loading ? 'Laedt...' : '\u21ba Refresh'}
          </button>
        </div>

        {/* ── KPI-Kacheln ── */}
        {o && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <Kachel label="Gesamtumsatz" value={eur(o.totalRevenue)} sub={`${o.paymentCount} Zahlungen`} stripe
                info="Summe aller bezahlten Bestellungen (Commerce 2.0), aus denen sich der HUI-Anteil und der Impact-Pool speisen." />
              <Kachel label={`Unternehmensanteil (${(COMPANY_RATE*100).toFixed(0)}%)`} value={eur(o.firmenanteil)} color="#F59E0B" stripe
                info="50% des HUI-Anteils (= 10% vom Umsatz). Davon werden zuerst Ambassador-Provisionen bezahlt, der Rest verteilt sich nach Unternehmensphase (Betrieb/Gewinn/Rücklagen)." />
              <Kachel label={`Impact-Pool (${(IMPACT_RATE*100).toFixed(0)}%)`} value={eur(o.bruttoPool)} color="var(--accent)" stripe
                info="30% des HUI-Anteils (= 6% vom Umsatz). Splittet weiter in Projekt-Anteil (70%) + Flex-Rücklage (30%)." />
              <Kachel label={`Innovationsfonds (${(INNOVATION_RATE*100).toFixed(0)}%)`} value={eur(o.innovationFund)} color="#8B5CF6" stripe
                info="20% des HUI-Anteils (= 4% vom Umsatz). Fließt in die Weiterentwicklung von HUI (Produkt, Tech, neue Features)." />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <Kachel label={`Projekt-Anteil (${(PROJECT_RATE*100).toFixed(1)}%)`} value={eur(o.nettoImpact)} color="#22C55E" stripe
                info="70% des Impact-Pools (= 4,2% vom Umsatz) fließen als Projektmittel in die Top-3 Herzensprojekte (Voting-basiert)." />
              <Kachel label={`Flex-Rücklage (${(FLEX_RATE*100).toFixed(1)}%)`} value={eur(o.flexPool)} color="#06B6D4" stripe
                info="30% des Impact-Pools (= 1,8% vom Umsatz). Reserve für Schwankungen — wird nicht direkt an Projekte ausgezahlt." />
              <Kachel label="Vergeben" value={eur(o.distributed)}
                info="Wie viel vom Projekt-Anteil bereits an genehmigte Projekte ausgezahlt wurde." />
              <Kachel label="Offen (verfuegbar)" value={eur(o.openImpact)} color="#818CF8"
                info="Projekt-Anteil abzüglich bereits Vergebenem — steht aktuell zur Verteilung an Projekte bereit." />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <Kachel label="Bewerbungen" value={String(o.applications.total)} sub={`${o.applications.approved} genehmigt`}
                info="Anzahl eingereichter Projekt-Bewerbungen für Impact-Förderung, davon wie viele bereits genehmigt wurden." />
              <Kachel label="Pool-Status" value={o.poolState} valueSize={16}
                info="accumulating = Pool sammelt gerade (6% der Zahlungen), noch nichts ausgezahlt. distributed = Pool wurde bereits an genehmigte Projekte ausgezahlt."
                color={o.poolState === 'accumulating' ? '#22C55E' : o.poolState === 'voting' ? '#F59E0B' : 'var(--text-muted)'} />
            </div>

            {/* Verteilungs-Erklärung: Balanced Growth v1 — nichts vergessen */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '14px 20px', marginBottom: 24, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Verteilungsregel (Balanced Growth v1):</strong>{' '}
              Umsatz 100% → Talent/Verkäufer 80% + HUI-Anteil 20%. HUI-Anteil 20% splittet in{' '}
              <strong>Unternehmen 10%</strong> + <strong>Impact-Pool 6%</strong> + <strong>Innovationsfonds 4%</strong>{' '}
              (= 10% Unternehmen + 10% "Impact-Seite"). Impact-Pool 6% splittet weiter in{' '}
              <strong>Projekte 4,2%</strong> (70%) + <strong>Flex-Rücklage 1,8%</strong> (30%).
            </div>

            {/* Umsatz nach Kategorie */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '16px 20px', marginBottom: 24 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>
                Umsatz nach Kategorie (Stripe-ready)
              </p>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[
                  { label: '🎨 Werke', key: 'work', color: '#6C63FF' },
                  { label: '✨ Talente', key: 'talent', color: '#3ECF8E' },
                  { label: '🌱 Spenden', key: 'donation', color: '#F59E0B' },
                  { label: '📋 Abos', key: 'subscription', color: '#06B6D4' },
                  { label: '♻️ Impact-Abo', key: 'impact_subscription', color: '#8B5CF6' },
                ].map(({ label, key, color }) => {
                  const val = o.revenueByType[key as keyof typeof o.revenueByType] ?? 0;
                  return (
                    <div key={key} style={{ minWidth: 120 }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>{label}</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color, margin: 0 }}>{eur(val)}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        {pct(val, o.totalRevenue)} vom Umsatz
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monatliche Entwicklung */}
            {o.monthly.length > 0 && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '16px 20px', marginBottom: 24 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>
                  Monatliche Entwicklung
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Monat','Umsatz','Impact-Pool (6%)','Zahlungen'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-muted)',
                          fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {o.monthly.map(m => (
                      <tr key={m.month} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.month}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--accent)' }}>{eur(m.revenue)}</td>
                        <td style={{ padding: '8px 12px', color: '#22C55E' }}>{eur(m.impact)}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{m.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {([
            { key: 'overview',     label: 'Übersicht' },
            { key: 'applications', label: `Bewerbungen${o ? ` (${o.applications.total})` : ''}` },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '8px 16px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: 13,
                background: tab === t.key ? 'var(--accent-dim)' : 'transparent',
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: tab === t.key ? 600 : 400 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Bewerbungen-Tab ── */}
        {tab === 'applications' && (
          <div>
            {/* Filter-Buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                { k: 'all',       l: `Alle (${apps.length})` },
                { k: 'submitted', l: `Eingereicht (${apps.filter(a=>a.status==='submitted').length})` },
                { k: 'approved',  l: `Genehmigt (${apps.filter(a=>a.status==='approved').length})` },
                { k: 'rejected',  l: `Abgelehnt (${apps.filter(a=>a.status==='rejected').length})` },
              ].map(({ k, l }) => (
                <button key={k} onClick={() => { setAppFilter(k); loadApps(k); }}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${appFilter===k?'var(--accent)':'var(--border)'}`,
                    background: appFilter===k ? 'var(--accent-dim)' : 'transparent',
                    color: appFilter===k ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: 12, cursor: 'pointer', fontWeight: appFilter===k ? 600 : 400 }}>
                  {l}
                </button>
              ))}
              <input type="text" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, minWidth: 180 }} />
            </div>

            {filteredApps.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
                Keine Bewerbungen gefunden.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredApps.map(a => (
                <div key={a.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => { setModal(a); setComment(''); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                          {a.project_name}
                        </span>
                        <StatusBadge status={a.status} />
                      </div>
                      {a.short_desc && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.4 }}>
                          {a.short_desc.slice(0, 120)}{a.short_desc.length > 120 ? '...' : ''}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                        {a.contact_name && <span>👤 {a.contact_name}</span>}
                        {a.location && <span>📍 {a.location}</span>}
                        {a.funding_goal && <span>🎯 Ziel: {eur(a.funding_goal)}</span>}
                        <span>📅 {fmtDate(a.submitted_at || a.created_at)}</span>
                      </div>
                    </div>
                    {a.status === 'submitted' && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button disabled={actionId === a.id}
                          onClick={() => handleAction(a.id, 'approve')}
                          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #22C55E',
                            background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                          {actionId === a.id ? '...' : 'Genehmigen'}
                        </button>
                        <button disabled={actionId === a.id}
                          onClick={() => { setModal(a); setComment(''); }}
                          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--red)',
                            background: 'rgba(255,107,107,0.08)', color: 'var(--red)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                          Ablehnen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Detail-Modal ── */}
        {modal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setModal(null)}>
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 14,
              padding: 28, maxWidth: 600, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{modal.project_name}</h2>
                <button onClick={() => setModal(null)}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>
                  ✕
                </button>
              </div>
              <StatusBadge status={modal.status} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
                {[
                  ['Kontakt', modal.contact_name],
                  ['E-Mail', modal.contact_email],
                  ['Standort', modal.location],
                  ['Förderziel', modal.funding_goal ? eur(modal.funding_goal) : null],
                  ['Eingereicht', fmtDate(modal.submitted_at)],
                  ['Bearbeitet', fmtDate(modal.reviewed_at)],
                ].map(([label, val]) => val ? (
                  <div key={label as string} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 2px', textTransform: 'uppercase' }}>{label}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{val}</p>
                  </div>
                ) : null)}
              </div>

              {modal.short_desc && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 6px' }}>Kurzbeschreibung</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{modal.short_desc}</p>
                </div>
              )}

              {modal.status === 'submitted' && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 6px' }}>
                    Kommentar (optional)
                  </p>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="Begruendung oder Anmerkung..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13,
                      resize: 'vertical', minHeight: 70, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button disabled={!!actionId} onClick={() => handleAction(modal.id, 'approve')}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #22C55E',
                        background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      {actionId === modal.id ? 'Wird gespeichert...' : 'Genehmigen'}
                    </button>
                    <button disabled={!!actionId} onClick={() => handleAction(modal.id, 'reject')}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--red)',
                        background: 'rgba(255,107,107,0.08)', color: 'var(--red)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      {actionId === modal.id ? '...' : 'Ablehnen'}
                    </button>
                  </div>
                </div>
              )}

              {modal.rejection_reason && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(255,107,107,0.06)', border: '1px solid var(--red)' }}>
                  <p style={{ fontSize: 11, color: 'var(--red)', margin: '0 0 4px', fontWeight: 600 }}>Ablehnungsgrund</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{modal.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
