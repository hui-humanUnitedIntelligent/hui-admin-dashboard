// frontend/src/app/reviews/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';
import { getStoredUser } from '@/lib/api';

// ── Config ────────────────────────────────────────────────────────────────
const HUI_API = 'https://be-hui.com/api';

// ── Types ─────────────────────────────────────────────────────────────────
interface Review {
  id: string;
  name: string;
  stars: number;
  message: string;
  date: string;
  submitted_at?: string;
  approvedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function StarDisplay({ stars }: { stars: number }) {
  const n = Math.min(5, Math.max(0, stars));
  return (
    <span style={{ fontSize: 16, letterSpacing: 2 }}>
      <span style={{ color: '#F59E0B' }}>{'★'.repeat(n)}</span>
      <span style={{ color: 'var(--border)', opacity: 0.5 }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

function avatarColor(id: string): string {
  const colors = ['#4ECDC4','#F7B731','#B197FC','#74C0FC','#51CF66','#FF6B6B'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 20, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-hover)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 13, width: '35%', background: 'var(--bg-hover)', borderRadius: 6, marginBottom: 6 }} />
              <div style={{ height: 11, width: '20%', background: 'var(--bg-hover)', borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ height: 12, width: '90%', background: 'var(--bg-hover)', borderRadius: 6, marginBottom: 6 }} />
          <div style={{ height: 12, width: '70%', background: 'var(--bg-hover)', borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

// ── Review Card ───────────────────────────────────────────────────────────
function ReviewCard({
  review, tab, onPublish, onDelete, busy,
}: {
  review: Review;
  tab: 'pending' | 'published';
  onPublish?: (id: string) => void;
  onDelete: (id: string) => void;
  busy: string | null;
}) {
  const isLoading = busy === review.id;
  const initial   = (review.name || '?').charAt(0).toUpperCase();
  const color     = avatarColor(review.id);

  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${tab === 'pending' ? 'rgba(251,191,36,0.25)' : 'var(--border)'}`,
      borderRadius: 14, padding: '18px 20px',
      opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.2s',
    }}>
      {/* Avatar + Name + Sterne */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#0F1117', flexShrink: 0,
        }}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
            {review.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StarDisplay stars={review.stars} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{review.date}</span>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          ...(tab === 'pending'
            ? { background: 'rgba(251,191,36,0.12)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }
            : { background: 'rgba(30,216,200,0.1)', color: 'var(--accent)', border: '1px solid rgba(30,216,200,0.3)' }
          ),
        }}>
          {tab === 'pending' ? '⏳ AUSSTEHEND' : '✅ LIVE'}
        </span>
      </div>

      {/* Nachricht */}
      <p style={{
        fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65,
        background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: 9,
        borderLeft: '3px solid var(--border)', margin: '0 0 14px 0',
      }}>
        {review.message}
      </p>

      {/* Aktionen */}
      <div style={{ display: 'flex', gap: 8 }}>
        {tab === 'pending' && onPublish && (
          <button
            onClick={() => onPublish(review.id)}
            disabled={isLoading}
            style={{
              padding: '7px 18px', border: 'none', borderRadius: 8,
              background: 'var(--accent)', color: '#0F1117',
              fontSize: 12.5, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)',
            }}
          >
            {isLoading ? '⏳ Bitte warten…' : '✅ Veröffentlichen'}
          </button>
        )}
        <button
          onClick={() => onDelete(review.id)}
          disabled={isLoading}
          style={{
            padding: '7px 14px', borderRadius: 8, cursor: isLoading ? 'not-allowed' : 'pointer',
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
            color: 'var(--red)', fontSize: 12.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)',
          }}
        >
          🗑️ {tab === 'pending' ? 'Ablehnen' : 'Löschen'}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function ReviewsPage() {
  const router = useRouter();
  const [tab,       setTab]       = useState<'pending' | 'published'>('pending');
  const [pending,   setPending]   = useState<Review[]>([]);
  const [published, setPublished] = useState<Review[]>([]);
  const [busy,      setBusy]      = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // SuperAdmin Guard
  useEffect(() => {
    const user = getStoredUser();
    if (!user || (user.role !== 'superadmin' && user.role !== 'super_admin')) {
      router.replace('/dashboard');
    }
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, pubRes] = await Promise.all([
        fetch(`${HUI_API}/get-pending-reviews`, { cache: 'no-store' }),
        fetch(`${HUI_API}/get-reviews`,         { cache: 'no-store' }),
      ]);
      const [pData, pubData] = await Promise.all([
        pRes.ok   ? pRes.json()   : [],
        pubRes.ok ? pubRes.json() : [],
      ]);
      setPending(Array.isArray(pData)   ? pData   : []);
      setPublished(Array.isArray(pubData) ? [...pubData].reverse() : []);
    } catch {
      setError('Verbindungsfehler — be-hui.com API nicht erreichbar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePublish = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`${HUI_API}/publish-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Serverfehler');
      showToast(`✅ Bewertung von ${data.review?.name || 'Nutzer'} veröffentlicht!`, 'success');
      await load();
    } catch (e) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`${HUI_API}/delete-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: tab }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Serverfehler');
      showToast(tab === 'pending' ? '🗑️ Abgelehnt & gelöscht' : '🗑️ Review entfernt', 'info');
      await load();
    } catch (e) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const reviews = tab === 'pending' ? pending : published;

  return (
    <DashboardLayout title="Community-Bewertungen">

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { icon: '⏳', label: 'Ausstehend',     value: pending.length,   accent: '#FBBF24', bg: 'rgba(251,191,36,0.08)' },
          { icon: '✅', label: 'Live auf Website', value: published.length, accent: 'var(--accent)', bg: 'rgba(30,216,200,0.08)' },
          { icon: '⭐', label: 'Gesamt',           value: pending.length + published.length, accent: 'var(--text-secondary)', bg: 'var(--bg-card)' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, border: '1px solid var(--border)', borderRadius: 12,
            padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, minWidth: 150,
          }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.accent, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {(['pending', 'published'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', border: 'none', background: 'transparent',
            fontSize: 13, fontWeight: tab === t ? 700 : 500,
            color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'var(--font-body)', marginBottom: -1,
          }}>
            {t === 'pending' ? `⏳ Ausstehend (${pending.length})` : `✅ Veröffentlicht (${published.length})`}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={load} style={{
          padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 8,
          background: 'transparent', fontSize: 12, color: 'var(--text-muted)',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>🔄 Aktualisieren</button>
      </div>

      {/* ── Content ── */}
      {error && (
        <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? <Skeleton /> : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>{tab === 'pending' ? '🎉' : '📭'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {tab === 'pending' ? 'Keine ausstehenden Bewertungen' : 'Noch keine veröffentlichten Bewertungen'}
          </div>
          <div style={{ fontSize: 13 }}>
            {tab === 'pending' ? 'Alle Eingaben wurden bearbeitet.' : 'Freigegebene Reviews erscheinen hier.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map(r => (
            <ReviewCard
              key={r.id} review={r} tab={tab}
              onPublish={tab === 'pending' ? handlePublish : undefined}
              onDelete={handleDelete}
              busy={busy}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
