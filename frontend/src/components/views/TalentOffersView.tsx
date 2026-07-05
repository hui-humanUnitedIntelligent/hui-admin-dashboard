// frontend/src/components/views/TalentOffersView.tsx
// Talent-Angebote (Content-Modul) — neu, NICHT zu verwechseln mit TalentsView.tsx (Talent-Pool).
// Superadmin: volle Freigabe/Ablehnen/Löschen-Verwaltung. Employee: Read-Only.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import { isSuperAdmin } from '@/lib/roles';

interface TalentOffer {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  images: { url: string; path?: string }[];
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  author: { display_name?: string; username?: string; avatar_url?: string; email?: string } | null;
  // Dienstleistungsfelder (MASTER-PROMPT 2026-07-05, additiv, siehe Migration 20260705_061)
  price_per_hour: number | null;
  price_per_session: number | null;
  currency: string | null;
  location_type: 'online' | 'vor_ort' | 'hybrid' | null;
  location_address: string | null;
  location_notes: string | null;
  map_link: string | null;
  available_dates: string[] | null;
  available_time_slots: { start: string; end: string }[] | null;
  recurring: 'weekly' | 'monthly' | null;
  duration_minutes: number | null;
  max_participants: number | null;
  min_participants: number | null;
  booking_type: 'einzel' | 'gruppe' | null;
  booking_window_start: string | null;
  booking_window_end: string | null;
}

type StatusTab = 'all' | 'pending' | 'approved' | 'rejected';

const TAB_LABELS: Record<StatusTab, string> = {
  all: 'Alle', pending: 'Prüfung', approved: 'Freigegeben', rejected: 'Abgelehnt',
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'Heute';
  if (d < 30) return `Vor ${d}d`;
  return `Vor ${Math.floor(d / 30)}mo`;
}

// ── Dienstleistungsdetails-Block (MASTER-PROMPT 2026-07-05) ──────────────
// Kompakte, gruppierte Read-Only-Anzeige aller neuen Felder — identisch fuer
// Superadmin (im Freigabe-Drawer) und Employee (Read-Only-Ansicht), da die
// gesamte TalentOffersView bereits rollenbasiert rendert (isAdmin gated nur
// die Aktions-Buttons, nicht die Anzeige).
const LOCATION_LABEL: Record<string, string> = { online: 'Online', vor_ort: 'Vor Ort', hybrid: 'Hybrid' };
const RECURRING_LABEL: Record<string, string> = { weekly: 'Wöchentlich', monthly: 'Monatlich' };
const BOOKING_LABEL: Record<string, string> = { einzel: 'Einzelbuchung', gruppe: 'Gruppenbuchung' };

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12.5 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function ServiceDetailBlock({ offer }: { offer: TalentOffer }) {
  const hasPrice = offer.price_per_hour != null || offer.price_per_session != null;
  const hasLocation = !!offer.location_type || !!offer.location_address;
  const hasSchedule = (offer.available_dates?.length ?? 0) > 0 || (offer.available_time_slots?.length ?? 0) > 0 || !!offer.recurring || !!offer.duration_minutes;
  const hasCapacity = !!offer.booking_type || offer.max_participants != null || offer.min_participants != null || !!offer.booking_window_start;

  if (!hasPrice && !hasLocation && !hasSchedule && !hasCapacity) return null;

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ marginBottom: 12, background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      {hasPrice && section('Preis', <>
        <DetailRow label="Pro Stunde" value={offer.price_per_hour != null ? `${offer.price_per_hour} ${offer.currency || 'EUR'}` : undefined} />
        <DetailRow label="Pro Termin/Session" value={offer.price_per_session != null ? `${offer.price_per_session} ${offer.currency || 'EUR'}` : undefined} />
      </>)}
      {hasLocation && section('Ort', <>
        <DetailRow label="Art" value={offer.location_type ? LOCATION_LABEL[offer.location_type] : undefined} />
        <DetailRow label="Adresse" value={offer.location_address} />
        <DetailRow label="Hinweise" value={offer.location_notes} />
        {offer.map_link && <DetailRow label="Karte" value={<a href={offer.map_link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Link öffnen</a>} />}
      </>)}
      {hasSchedule && section('Datum & Zeiten', <>
        <DetailRow label="Termine" value={offer.available_dates && offer.available_dates.length > 0 ? offer.available_dates.join(', ') : undefined} />
        <DetailRow label="Zeitfenster" value={offer.available_time_slots && offer.available_time_slots.length > 0 ? offer.available_time_slots.map(s => `${s.start}–${s.end}`).join(', ') : undefined} />
        <DetailRow label="Wiederholung" value={offer.recurring ? RECURRING_LABEL[offer.recurring] : undefined} />
        <DetailRow label="Dauer" value={offer.duration_minutes ? `${offer.duration_minutes} Min.` : undefined} />
      </>)}
      {hasCapacity && section('Kapazität & Buchbarkeit', <>
        <DetailRow label="Buchungsart" value={offer.booking_type ? BOOKING_LABEL[offer.booking_type] : undefined} />
        <DetailRow label="Teilnehmer" value={(offer.min_participants || offer.max_participants) ? `${offer.min_participants ?? '–'}–${offer.max_participants ?? '–'}` : undefined} />
        <DetailRow label="Buchungszeitraum" value={(offer.booking_window_start || offer.booking_window_end) ? `${offer.booking_window_start ? new Date(offer.booking_window_start).toLocaleDateString('de-DE') : '–'} – ${offer.booking_window_end ? new Date(offer.booking_window_end).toLocaleDateString('de-DE') : '–'}` : undefined} />
      </>)}
    </div>
  );
}

export function TalentOffersView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = (currentUser?.role ?? role) as 'superadmin' | 'employee';
  const isAdmin = isSuperAdmin(currentUser?.role) || role === 'superadmin';

  const [items, setItems] = useState<TalentOffer[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>('all'); // Nutzeranfrage 2026-07-05: 'Alle' immer zuerst anzeigen
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TalentOffer | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; reason: string }>({ open: false, reason: '' });

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: tab, limit: '200' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/talent-offers?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setItems(Array.isArray(d.talents) ? d.talents : []);
      setCounts(d.counts ?? { all: 0, pending: 0, approved: 0, rejected: 0 });
    } catch (e) {
      console.error('[talent-offers]', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { load(); }, [load]);

  async function doAction(action: string, id: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await fetch('/api/talent-offers', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, _action: action, ...extra }),
      });
      setBusy(false);
      return res.ok;
    } catch { setBusy(false); return false; }
  }

  async function handleApprove(t: TalentOffer) {
    const success = await doAction('approve_talent', t.id);
    if (success) { showToast('✅ Talent-Angebot freigegeben'); setSelected(null); load(); }
    else showToast('Fehler');
  }

  function handleReject() {
    setRejectModal({ open: true, reason: '' });
  }

  async function confirmReject() {
    if (!selected) return;
    const reason = rejectModal.reason.trim() || 'Nicht genehmigt';
    setRejectModal({ open: false, reason: '' });
    const success = await doAction('reject_talent', selected.id, { rejection_reason: reason });
    if (success) { showToast('❌ Talent-Angebot abgelehnt'); setSelected(null); load(); }
    else showToast('Fehler');
  }

  async function handleDelete(t: TalentOffer) {
    if (!confirm(`„${t.title}" endgültig löschen?`)) return;
    const success = await doAction('delete_talent', t.id);
    if (success) { showToast('🗑️ Gelöscht'); setSelected(null); load(); }
    else showToast('Fehler');
  }

  const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: 600 };
  const tdS: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle', fontSize: 13 };

  const statusColor = (s: string) => s === 'approved' ? '#51CF66' : s === 'rejected' ? '#FF6B6B' : '#F7B731';
  const statusLabel = (s: string) => s === 'approved' ? '✅ Live' : s === 'rejected' ? '❌ Abgelehnt' : '⏳ Prüfung';

  const content = (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'var(--accent)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{toast}</div>
      )}

      <PageHeader
        title="Talente"
        subtitle="Talent-Angebote & Dienstleistungen der Nutzer"
        badge={counts.pending > 0 ? <span style={{ background: '#F7B731', color: '#1A1A18', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{counts.pending} offen</span> : undefined}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(Object.keys(TAB_LABELS) as StatusTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: tab === t ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            background: tab === t ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: tab === t ? '#fff' : 'var(--text-secondary)',
          }}>
            {TAB_LABELS[t]} ({counts[t]})
          </button>
        ))}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Titel oder Name…"
          style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, minWidth: 220 }}
        />
      </div>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Lädt…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Keine Talent-Angebote in dieser Kategorie.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thS}>Titel</th>
                <th style={thS}>Kategorie</th>
                <th style={thS}>Anbieter</th>
                <th style={thS}>Status</th>
                <th style={thS}>Eingereicht</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id} onClick={() => setSelected(t)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <td style={tdS}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.images?.[0]?.url && <img src={t.images[0].url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
                      <span style={{ fontWeight: 600 }}>{t.title}</span>
                    </div>
                  </td>
                  <td style={tdS}>{t.category}</td>
                  <td style={tdS}>{t.author?.display_name || t.author?.username || '—'}</td>
                  <td style={tdS}><span style={{ color: statusColor(t.status), fontWeight: 600 }}>{statusLabel(t.status)}</span></td>
                  <td style={tdS}>{timeAgo(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.category}</div>
              </div>
              <span style={{ color: statusColor(selected.status), fontWeight: 700, fontSize: 13 }}>{statusLabel(selected.status)}</span>
            </div>

            {selected.images?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                {selected.images.map((img, i) => (
                  <img key={i} src={img.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
                ))}
              </div>
            )}

            {selected.description && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>{selected.description}</div>
            )}

            {selected.status === 'rejected' && selected.rejection_reason && (
              <div style={{ background: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, marginBottom: 14 }}>
                Ablehnungsgrund: {selected.rejection_reason}
              </div>
            )}

            {/* ── Dienstleistungsdetails (MASTER-PROMPT 2026-07-05, Read-Only fuer beide Rollen — Bearbeitung nur in der App) ── */}
            <ServiceDetailBlock offer={selected} />

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Anbieter</span>
              <span style={{ fontWeight: 600 }}>{selected.author?.display_name || selected.author?.username || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Eingereicht</span>
              <span style={{ fontWeight: 600 }}>{new Date(selected.created_at).toLocaleDateString('de-DE')}</span>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {isAdmin && selected.status !== 'approved' && (
                <button disabled={busy} onClick={() => handleApprove(selected)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#51CF66', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Freigeben
                </button>
              )}
              {isAdmin && selected.status !== 'rejected' && (
                <button disabled={busy} onClick={handleReject} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#FF6B6B', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  Ablehnen
                </button>
              )}
              {isAdmin && (
                <button disabled={busy} onClick={() => handleDelete(selected)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: '#FF6B6B', cursor: 'pointer', fontSize: 13 }}>
                  Löschen
                </button>
              )}
              <button onClick={() => setSelected(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal.open && (
        <div onClick={() => setRejectModal({ open: false, reason: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Ablehnungsgrund</div>
            <textarea
              value={rejectModal.reason} onChange={e => setRejectModal(p => ({ ...p, reason: e.target.value }))}
              placeholder="Warum wird dieses Angebot abgelehnt?"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectModal({ open: false, reason: '' })} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Abbrechen</button>
              <button onClick={confirmReject} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#FF6B6B', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Ablehnen bestätigen</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return role === 'employee' ? (
    <EmployeeLayout title="Talente">{content}</EmployeeLayout>
  ) : (
    <DashboardLayout title="Talente">{content}</DashboardLayout>
  );
}
