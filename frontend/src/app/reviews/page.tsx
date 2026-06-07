// frontend/src/app/reviews/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';
import { getStoredUser } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────
interface Review {
  id: string;
  name: string;
  stars: number;
  message: string;
  date: string;
  submitted_at?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function StarDisplay({ stars }: { stars: number }) {
  return (
    <span style={{ color: '#F5A623', fontSize: 14, letterSpacing: 1 }}>
      {'★'.repeat(Math.max(0, stars))}
      <span style={{ opacity: 0.3 }}>{'★'.repeat(Math.max(0, 5 - stars))}</span>
    </span>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', opacity: 0.5 }}>
          <div style={{ height: 14, width: '40%', background: 'var(--bg-hover)', borderRadius: 6, marginBottom: 10 }} />
          <div style={{ height: 12, width: '80%', background: 'var(--bg-hover)', borderRadius: 6, marginBottom: 6 }} />
          <div style={{ height: 12, width: '60%', background: 'var(--bg-hover)', borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

// ── Review Card ───────────────────────────────────────────────────────────
function ReviewCard({
  review, type, onAction, loading
}: {
  review: Review;
  type: 'pending' | 'published';
  onAction: (id: string, action: string) => void;
  loading: string | null;
}) {
  const isLoading = loading === review.id;
  const initial = (review.name || '?').charAt(0).toUpperCase();
  const avatarColors = ['#4ECDC4', '#F7B731', '#B197FC', '#74C0FC', '#51CF66', '#FF6B6B'];
  let h = 0;
  for (let i = 0; i < review.id.length; i++) h = (h * 31 + review.id.charCodeAt(i)) & 0xffffffff;
  const avatarColor = avatarColors[Math.abs(h) % avatarColors.length];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '18px 20px',
      transition: 'border-color 0.15s',
      opacity: isLoading ? 0.6 : 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#0F1117', flexShrink: 0,
        }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{review.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StarDisplay stars={review.stars} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{review.date}</span>
          </div>
        </div>
        {type === 'pending' && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px',
            background: 'rgba(251,191,36,0.15)', color: '#FBBF24',
            border: '1px solid rgba(251,191,36,0.3)', borderRadius: 20,
          }}>AUSSTEHEND</span>
        )}
        {type === 'published' && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px',
            background: 'rgba(30,216,200,0.12)', color: 'var(--accent)',
            border: '1px solid rgba(30,216,200,0.3)', borderRadius: 20,
          }}>LIVE</span>
        )}
      </div>

      {/* Message */}
      <p style={{
        fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6,
        margin: '0 0 14px 0', padding: '10px 14px',
        background: 'var(--bg-primary)', borderRadius: 8,
        borderLeft: '3px solid var(--border)',
      }}>
        {review.message}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {type === 'pending' && (
          <>
            <button
              onClick={() => onAction(review.id, 'approve')}
              disabled={isLoading}
              style={{
                padding: '7px 16px', border: 'none', borderRadius: 8,
                background: 'var(--accent)', color: '#0F1117',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: isLoading ? 0.5 : 1, fontFamily: 'var(--font-body)',
              }}
            >
              {isLoading ? '⏳' : '✅'} Veröffentlichen
            </button>
            <button
              onClick={() => onAction(review.id, 'reject')}
              disabled={isLoading}
              style={{
                padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8,
                background: 'transparent', color: 'var(--red)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: isLoading ? 0.5 : 1, fontFamily: 'var(--font-body)',
              }}
            >
              🗑️ Ablehnen
            </button>
          </>
        )}
        {type === 'published' && (
          <button
            onClick={() => onAction(review.id, 'delete_published')}
            disabled={isLoading}
            style={{
              padding: '7px 14px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              background: 'rgba(239,68,68,0.06)', color: 'var(--red)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: isLoading ? 0.5 : 1, fontFamily: 'var(--font-body)',
            }}
          >
            {isLoading ? '⏳' : '🗑️'} Löschen
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ReviewsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'pending' | 'published'>('pending');
  const [pending,   setPending]   = useState<Review[]>([]);
  const [published, setPublished] = useState<Review[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [fetching,  setFetching]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Super Admin Guard
  useEffect(() => {
    const user = getStoredUser();
    if (!user || (user.role !== 'superadmin' && user.role !== 'super_admin')) {
      router.replace('/dashboard');
    }
  }, [router]);

  const loadReviews = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [pRes, pubRes] = await Promise.all([
        fetch('/api/reviews?type=pending',   { cache: 'no-store' }),
        fetch('/api/reviews?type=published', { cache: 'no-store' }),
      ]);
      const [pData, pubData] = await Promise.all([
        pRes.ok   ? pRes.json()   : [],
        pubRes.ok ? pubRes.json() : [],
      ]);
      setPending(pData);
      setPublished(pubData.slice().reverse()); // newest first
    } catch {
      setError('Fehler beim Laden der Bewertungen.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const handleAction = async (id: string, action: string) => {
    setLoadingId(id);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) throw new Error('Serverfehler');
      const msgs: Record<string, string> = {
        approve:          '✅ Bewertung veröffentlicht!',
        reject:           '🗑️ Bewertung abgelehnt',
        delete_published: '🗑️ Bewertung gelöscht',
      };
      showToast(msgs[action] || 'Erledigt', 'success');
      await loadReviews();
    } catch (err) {
      showToast('Fehler: ' + (err instanceof Error ? err.message : 'Unbekannt'), 'error');
    } finally {
      setLoadingId(null);
    }
  };

  const reviews = tab === 'pending' ? pending : published;

  return (
    <DashboardLayout title="Community-Bewertungen">
      {/* ── Header Stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Ausstehend', value: pending.length,   color: '#FBBF24', bg: 'rgba(251,191,36,0.1)', icon: '⏳' },
          { label: 'Veröffentlicht', value: published.length, color: 'var(--accent)', bg: 'rgba(30,216,200,0.1)', icon: '✅' },
          { label: 'Gesamt', value: pending.length + published.length, color: 'var(--text-secondary)', bg: 'var(--bg-card)', icon: '⭐' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: stat.bg, border: '1px solid var(--border)',
            borderRadius: 12, padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 12, minWidth: 140,
          }}>
            <span style={{ fontSize: 22 }}>{stat.icon}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['pending', 'published'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', border: 'none', background: 'transparent',
              fontSize: 13, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              transition: 'all 0.15s', marginBottom: -1,
            }}
          >
            {t === 'pending' ? `⏳ Ausstehend (${pending.length})` : `✅ Veröffentlicht (${published.length})`}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={loadReviews}
          style={{
            padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8,
            background: 'transparent', fontSize: 12, color: 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'var(--font-body)', marginBottom: 4,
          }}
        >
          🔄 Aktualisieren
        </button>
      </div>

      {/* ── Content ── */}
      {error && (
        <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {fetching ? (
        <Skeleton />
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{tab === 'pending' ? '🎉' : '📭'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {tab === 'pending' ? 'Keine ausstehenden Bewertungen' : 'Noch keine Bewertungen veröffentlicht'}
          </div>
          <div style={{ fontSize: 13 }}>
            {tab === 'pending' ? 'Alle Bewertungen wurden bearbeitet.' : 'Veröffentlichte Bewertungen erscheinen hier.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map(r => (
            <ReviewCard key={r.id} review={r} type={tab} onAction={handleAction} loading={loadingId} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
