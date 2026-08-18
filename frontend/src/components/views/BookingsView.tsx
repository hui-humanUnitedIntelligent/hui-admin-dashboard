// frontend/src/components/views/BookingsView.tsx
// ARCH-007 — Vereinheitlichte Buchungsübersicht: Talente + Erlebnisse + Werke, live aus der App.
'use client';

import { Fragment, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { statusToBadge } from '@/components/ui/Badge';
import { useBookings, getBookingDetails, HuiBooking } from '@/lib/hooks/useSupabase';
import { usePaginatedList } from '@/lib/hooks/usePaginatedList';
import PaginationControls from '@/components/ui/PaginationControls';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 7)  return `Vor ${days} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE');
}

const TYPE_LABEL: Record<string, string> = {
  work: 'Werk', talent: 'Talent', experience: 'Erlebnis', project: 'Projekt', donation: 'Spende', subscription: 'Abo',
};

const SOURCE_ICON: Record<string, string> = {
  talent: '🎯', experience: '🎪', work: '🎨',
};

const TIER_LABEL: Record<string, string> = {
  bronze: 'Bronze', silber: 'Silber', silver: 'Silber', gold: 'Gold', platin: 'Platin', platinum: 'Platin',
};

function Skeleton() {
  return (
    <tr>
      {[...Array(11)].map((_, i) => (
        <td key={i} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: '60%' }} />
        </td>
      ))}
    </tr>
  );
}

function EventInfo({ b }: { b: HuiBooking }) {
  const parts: string[] = [];
  if (b.event_date) {
    const d = new Date(b.event_date);
    parts.push(d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }));
  }
  if (b.time_start) parts.push(b.time_start);
  if (b.location) parts.push(b.location.length > 25 ? b.location.slice(0, 25) + '…' : b.location);
  if (b.participants != null) parts.push(`${b.participants} Pers.`);
  return <>{parts.join(' · ') || '—'}</>;
}

function DetailPanel({ booking, loadingDetail }: { booking: HuiBooking; loadingDetail: boolean }) {
  const stripeUrl = booking.payment_id && !booking.payment_id.startsWith('dummy') && !booking.payment_id.startsWith('tb_') && !booking.payment_id.startsWith('bos_')
    ? `https://dashboard.stripe.com/payments/${booking.payment_id}`
    : null;

  const rows: [string, React.ReactNode][] = [
    ['Buchungs-ID', booking.booking_id],
    ['Quelle', booking.source ? (SOURCE_ICON[booking.source] + ' ' + TYPE_LABEL[booking.source]) : '—'],
    ['Status', statusToBadge(booking.status)],
    ['Erstellt', new Date(booking.created_at).toLocaleString('de-DE')],
    ['Aktualisiert', booking.updated_at ? new Date(booking.updated_at).toLocaleString('de-DE') : '—'],

    ['Nutzer', <a key="u" href={`/users?search=${booking.user_id}`} style={{ color: 'var(--accent)' }}>{booking.user_name || booking.user_id}</a>],
    ['Nutzer E-Mail', booking.user_email || '—'],

    ['Wirker', <a key="w" href={`/users?search=${booking.wirker_id}`} style={{ color: 'var(--accent)' }}>{booking.wirker_name || booking.wirker_id}</a>],
    ['Wirker E-Mail', booking.wirker_email || '—'],

    ['Typ', TYPE_LABEL[booking.type || 'work'] || booking.type || '—'],
    ['Titel', booking.item_title || '—'],

    // Event-/Termin-Infos — ARCH-007
    ['Termin', booking.event_date ? new Date(booking.event_date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
    ['Uhrzeit', [booking.time_start, booking.time_end].filter(Boolean).join(' – ') || '—'],
    ['Ort', booking.location || '—'],
    ['Teilnehmer', booking.participants != null ? String(booking.participants) : '—'],
    ['Plätze frei', booking.spots_available != null ? String(booking.spots_available) : '—'],
    ['Max. Teilnehmer', booking.max_participants != null ? String(booking.max_participants) : '—'],

    ['Zahlungs-ID (Stripe)', stripeUrl
      ? <a key="p" href={stripeUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{booking.payment_id}</a>
      : (booking.payment_id || '—')],
    ['Betrag', `€${(booking.payment_amount ?? booking.amount ?? 0).toFixed(2)} ${(booking.currency || 'eur').toUpperCase()}`],
    ['Plattform-Gebühr', `€${(booking.platform_fee || 0).toFixed(2)}`],
    ['Impact-Gebühr', `€${(booking.impact_fee || 0).toFixed(2)}`],
    ['Ambassador-Provision', `€${(booking.ambassador_commission ?? booking.commission_amount ?? 0).toFixed(2)}`],
    ['Stripe Charge ID', booking.stripe_charge_id || '—'],
    ['Zahlungsstatus', statusToBadge(booking.payment_status_live || booking.payment_status)],

    ['Impact-Pool-Eintrag', booking.impact_pool_entry_id || '—'],
    ['Impact-Betrag', booking.impact_amount != null ? `€${booking.impact_amount.toFixed(2)}` : '—'],
    ['Impact-Quelle', booking.impact_source || '—'],

    ['Ambassador', booking.ambassador_name
      ? <a key="a" href={`/ambassadors`} style={{ color: 'var(--accent)' }}>{booking.ambassador_name}</a>
      : '—'],
    ['Ambassador-Tier', booking.ambassador_tier ? (TIER_LABEL[booking.ambassador_tier] || booking.ambassador_tier) : '—'],
  ];

  return (
    <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border)', fontSize: 12 }}>
      {loadingDetail ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Lade Details…</div>
      ) : (
        <>
          {/* Event-Highlight-Box bei Erlebnissen */}
          {booking.source === 'experience' && booking.event_date && (
            <div style={{ marginBottom: 14, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>🎪 Erlebnis</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{booking.item_title || 'Ohne Titel'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {new Date(booking.event_date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                {booking.time_start && ` · ${booking.time_start}${booking.time_end ? `–${booking.time_end}` : ''}`}
                {booking.location && ` · ${booking.location}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {booking.participants != null && `${booking.participants} Teilnehmer`}
                {booking.spots_available != null && ` · ${booking.spots_available} Plätze frei`}
                {booking.max_participants != null && ` · Max. ${booking.max_participants}`}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {rows.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{k}</div>
                <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-all' }}>{v}</div>
              </div>
            ))}
          </div>
          {booking.metadata && Object.keys(booking.metadata).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>Metadaten</div>
              <pre style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, overflowX: 'auto' }}>
                {JSON.stringify(booking.metadata, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function BookingsView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HuiBooking | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { bookings, total, loading, refetch } = useBookings({ status: statusFilter, limit: 1000, refreshInterval: 0 });

  // Pagination: fix 20 pro Seite, echte Seiten-Navigation (kein "Mehr laden")
  const { pageItems: pagedBookings, page, totalPages, goToPage, total: pagedTotal } =
    usePaginatedList(bookings, 'created_at');

  // Client-side type filter (API supports it too, but this handles already-fetched data)
  const filteredBookings = typeFilter === 'all' ? bookings : bookings.filter(b => b.type === typeFilter || b.source === typeFilter);
  const { pageItems: pagedFiltered, total: pagedFilteredTotal, totalPages: tpFiltered, page: pageF, goToPage: goF } = usePaginatedList(filteredBookings, 'created_at');

  const totalAmount = filteredBookings.reduce((s, b) => s + (b.amount || 0), 0);
  const totalImpact = filteredBookings.reduce((s, b) => s + (b.impact_fee || 0), 0);

  const handleRowClick = async (b: HuiBooking) => {
    if (selectedId === b.booking_id) { setSelectedId(null); setDetail(null); return; }
    setSelectedId(b.booking_id);
    setLoadingDetail(true);
    const full = await getBookingDetails(b.booking_id);
    setDetail(full || b);
    setLoadingDetail(false);
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  });

  return (
    <DashboardLayout employeeMode={role === 'employee'} title="Buchungen">
      <PageHeader
        title="Buchungen"
        subtitle={role === 'employee' ? 'Buchungs-Übersicht' : 'Alle Buchungen — Talente, Erlebnisse & Werke live'}
        actionsRole={role === 'employee' ? 'employee' : 'admin'}
        userRole={userRole}
        actions={
          <button onClick={refetch} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            ↻ Refresh
          </button>
        }
      />

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }} className="grid-4">
        {[
          { label: 'Buchungen total',     value: loading ? '…' : String(filteredBookings.length),         color: 'var(--accent)' },
          { label: 'Volumen',             value: loading ? '…' : `€${totalAmount.toFixed(0)}`,              color: 'var(--gold)' },
          { label: 'Impact-Gebühren',     value: loading ? '…' : `€${totalImpact.toFixed(0)}`,              color: 'var(--green)' },
          { label: 'Bestätigt',           value: loading ? '…' : String(filteredBookings.filter(b => b.status === 'confirmed' || b.status === 'paid').length), color: 'var(--purple)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter — Status */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {['all','confirmed','pending','cancelled','completed'].map((s) => (
          <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => { setStatusFilter(s); setSelectedId(null); }}>
            {s === 'all' ? 'Alle' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Filter — Typ (Talente / Erlebnisse / Werke) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { key: 'all',        label: 'Alle' },
          { key: 'talent',     label: '🎯 Talente' },
          { key: 'experience', label: '🎪 Erlebnisse' },
          { key: 'work',       label: '🎨 Werke' },
        ].map(({ key, label }) => (
          <button key={key} style={filterBtnStyle(typeFilter === key)} onClick={() => { setTypeFilter(key); setSelectedId(null); }}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Typ', 'Titel', 'User', 'Wirker', 'Betrag', 'Status', 'Termin/Ort', 'Zahlung', 'Datum'].map((h) => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton /><Skeleton /><Skeleton /><Skeleton /></>
              ) : pagedFiltered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Keine Buchungen gefunden</td></tr>
              ) : pagedFiltered.map((b) => (
                <Fragment key={b.booking_id}>
                  <tr className="tr-hover" onClick={() => handleRowClick(b)}
                    style={{ background: selectedId === b.booking_id ? 'var(--accent-dim)' : 'transparent', cursor: 'pointer' }}>
                    <td style={{ padding: '9px 14px', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      <span title={TYPE_LABEL[b.type || ''] || b.type}>{SOURCE_ICON[b.source || b.type || ''] || '📋'}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{TYPE_LABEL[b.type || ''] || b.type || '—'}</span>
                    </td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-primary)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{b.item_title || '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{b.user_name || (b.user_id ? b.user_id.slice(0,8)+'…' : '—')}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{b.wirker_name || (b.wirker_id ? b.wirker_id.slice(0,8)+'…' : '—')}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>€{(b.amount||0).toFixed(2)}</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>{statusToBadge(b.status)}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                      <EventInfo b={b} />
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>{statusToBadge(b.payment_status)}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{timeAgo(b.created_at)}</td>
                  </tr>
                  {selectedId === b.booking_id && (
                    <tr>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <DetailPanel booking={detail || b} loadingDetail={loadingDetail} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <PaginationControls
            visibleCount={pagedFiltered.length} total={pagedFilteredTotal}
            page={pageF} totalPages={tpFiltered} onGoToPage={goF}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
