// frontend/src/app/reviews/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';

interface Review {
  id: string;
  workId?: string;
  workTitle?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string | null;
  text: string;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const h = Math.floor(mins / 60);
  if (h < 24)   return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

export default function ReviewsPage() {
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [search,  setSearch]    = useState('');
  const [delId,   setDelId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews?limit=200', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr: Review[] = Array.isArray(data.reviews) ? data.reviews
                          : Array.isArray(data) ? data : [];
      setReviews(arr);
    } catch (e) {
      setError('Fehler beim Laden: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Kommentar endgueltig loeschen?')) return;
    setDelId(id);
    try {
      const res = await fetch('/api/reviews', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Kommentar geloescht.', 'info');
        setReviews(prev => prev.filter(r => r.id !== id));
      } else {
        showToast('Fehler: ' + (data.error || 'Unbekannt'), 'error');
      }
    } catch {
      showToast('Netzwerkfehler.', 'error');
    } finally {
      setDelId(null);
    }
  };

  const filtered = search.trim()
    ? reviews.filter(r =>
        [r.text, r.userName, r.workTitle].some(v =>
          (v || '').toLowerCase().includes(search.toLowerCase())))
    : reviews;

  return (
    <DashboardLayout title="Reviews & Kommentare">
      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Reviews & Kommentare
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Alle Nutzer-Kommentare auf Werke &mdash; {loading ? '...' : `${reviews.length} gesamt`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
              fontSize: 13, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Laedt...' : '\u21ba Aktualisieren'}
          </button>
        </div>

        {/* Suchfeld */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Suche nach Kommentar, Nutzer oder Werk..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        {/* Fehler */}
        {error && (
          <div style={{ padding: 14, borderRadius: 8, background: 'rgba(255,107,107,0.1)',
            border: '1px solid var(--red)', color: 'var(--red)', marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            Kommentare werden geladen...
          </div>
        )}

        {/* Leer */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            {search ? 'Keine Treffer fuer diese Suche.' : 'Noch keine Kommentare vorhanden.'}
          </div>
        )}

        {/* Kommentar-Liste */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(r => (
              <div key={r.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Avatar */}
                    {r.userAvatar ? (
                      <img src={r.userAvatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>
                        {(r.userName || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                        {r.userName || 'Unbekannt'}
                      </span>
                      {r.workTitle && r.workTitle !== '\u2014' && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                          &rarr; <span style={{ color: 'var(--accent)' }}>{r.workTitle}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {timeAgo(r.createdAt)}
                    </span>
                    <button
                      disabled={delId === r.id}
                      onClick={() => handleDelete(r.id)}
                      style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--red)',
                        background: 'transparent', color: 'var(--red)', fontSize: 11,
                        cursor: 'pointer', opacity: delId === r.id ? 0.5 : 1 }}>
                      {delId === r.id ? '...' : 'Loeschen'}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
          {filtered.length} von {reviews.length} Kommentaren
        </div>
      </div>
    </DashboardLayout>
  );
}
