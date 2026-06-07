// frontend/src/app/reviews/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';
import { getStoredUser } from '@/lib/api';

const BEE_API = 'https://be-hui.com/api';

interface Review {
  id: string;
  name: string;
  stars: number;
  message: string;
  date: string;
  submitted_at?: string;
  approvedAt?: string;
}

function StarDisplay({ stars }: { stars: number }) {
  const n = Math.min(5, Math.max(0, stars));
  return (
    <span style={{ letterSpacing: 1 }}>
      <span style={{ color: '#F59E0B' }}>{'★'.repeat(n)}</span>
      <span style={{ color: '#ccc' }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const router  = useRouter();
  const [tab,       setTab]       = useState<'published' | 'pending'>('published');
  const [published, setPublished] = useState<Review[]>([]);
  const [pending,   setPending]   = useState<Review[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) router.replace('/dashboard');
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Veröffentlicht: direkt public JSON
      const pubRes = await fetch(`https://be-hui.com/data/reviews.json?t=${Date.now()}`, { cache: 'no-store' });
      const pubData: Review[] = pubRes.ok ? await pubRes.json() : [];

      // Ausstehend: über be-hui.com API (hat GH_TOKEN)
      let penData: Review[] = [];
      try {
        const penRes = await fetch(`${BEE_API}/get-pending-reviews?t=${Date.now()}`, { cache: 'no-store' });
        if (penRes.ok) penData = await penRes.json();
      } catch { /* ignore */ }

      setPublished(Array.isArray(pubData) ? [...pubData].reverse() : []);
      setPending(Array.isArray(penData)   ? [...penData].reverse()  : []);
    } catch {
      setError('Verbindungsfehler zur be-hui.com API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Löschen (veröffentlicht) ────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setBusy(id);
    setConfirmId(null);
    try {
      const res = await fetch(`${BEE_API}/delete-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: 'published' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Serverfehler');
      showToast('🗑️ Review gelöscht', 'info');
      await load();
    } catch (e) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error');
    } finally {
      setBusy(null);
    }
  };

  // ── Veröffentlichen (ausstehend → live) ─────────────────────────────────
  const handlePublish = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`${BEE_API}/reviews?action=approve&id=${encodeURIComponent(id)}&token=hui-review-secret-2026`, {
        method: 'GET',
      });
      // reviews.js gibt HTML zurück bei GET — nutze stattdessen direkt publish-review
      const res2 = await fetch(`${BEE_API}/publish-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res2.ok) {
        const d = await res2.json().catch(() => ({}));
        throw new Error(d.error || 'Serverfehler');
      }
      showToast('✅ Bewertung veröffentlicht', 'success');
      await load();
    } catch (e) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error');
    } finally {
      setBusy(null);
    }
  };

  // ── Ablehnen (ausstehend löschen) ───────────────────────────────────────
  const handleReject = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`${BEE_API}/delete-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: 'pending' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Serverfehler');
      showToast('🗑️ Abgelehnt & entfernt', 'info');
      await load();
    } catch (e) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const reviews = tab === 'published' ? published : pending;

  // ── Confirm Modal ────────────────────────────────────────────────────────
  const ConfirmModal = () => {
    if (!confirmId) return null;
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 17, 23, 0.82)',
        backdropFilter: 'none',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: '#1E2130',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '32px 36px',
          maxWidth: 400, width: '90%',
          textAlign: 'center',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🗑️</div>
          <h3 style={{ color: '#F1F5F9', marginBottom: 10, fontSize: 17, fontWeight: 700 }}>
            Review löschen?
          </h3>
          <p style={{ color: '#94A3B8', fontSize: 13.5, lineHeight: 1.6, marginBottom: 28 }}>
            Dieser Review wird sofort von <strong style={{ color: '#F1F5F9' }}>be-hui.com</strong> entfernt.<br />
            Diese Aktion ist nicht rückgängig machbar.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => setConfirmId(null)}
              style={{
                padding: '10px 24px', borderRadius: 9,
                background: '#2A2D3E', border: '1px solid rgba(255,255,255,0.12)',
                color: '#CBD5E1', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                fontFamily: 'var(--font-body)',
              }}
            >Abbrechen</button>
            <button
              onClick={() => handleDelete(confirmId)}
              style={{
                padding: '10px 24px', borderRadius: 9,
                background: '#EF4444', border: 'none',
                color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                fontFamily: 'var(--font-body)',
                boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
              }}
            >Ja, löschen</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout title="Review-Verwaltung">
      <ConfirmModal />

      {/* Stats */}
      <div style={{ display:'flex', gap:12, marginBottom:28, flexWrap:'wrap', alignItems:'stretch' }}>
        {[
          { icon:'✅', label:'Live auf Website',  value:published.length, accent:'var(--accent)',          bg:'rgba(30,216,200,0.08)' },
          { icon:'⏳', label:'Ausstehend',         value:pending.length,   accent:'#FBBF24',                bg:'rgba(251,191,36,0.08)' },
          { icon:'💬', label:'Gesamt',             value:published.length + pending.length, accent:'var(--text-secondary)', bg:'var(--bg-card)' },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, border:'1px solid var(--border)', borderRadius:12, padding:'14px 20px', display:'flex', alignItems:'center', gap:14, minWidth:160 }}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize:26, fontWeight:700, color:s.accent, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{s.label}</div>
            </div>
          </div>
        ))}
        <button onClick={load} style={{ marginLeft:'auto', padding:'10px 18px', borderRadius:10, background:'var(--bg-hover)', border:'1px solid var(--border)', color:'var(--text-secondary)', cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:7, fontFamily:'var(--font-body)' }}>
          🔄 Aktualisieren
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20 }}>
        {([['published','✅ Veröffentlicht'],['pending','⏳ Ausstehend']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding:'9px 20px', borderRadius:9, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, fontWeight:600, border:tab===key?'none':'1px solid var(--border)', background:tab===key?'var(--accent)':'var(--bg-hover)', color:tab===key?'#0F1117':'var(--text-secondary)', transition:'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Fehler */}
      {error && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:10, padding:'12px 16px', marginBottom:20, color:'var(--red)', fontSize:13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Tabelle */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:tab==='published'?'120px 150px 100px 1fr 100px 120px':'120px 150px 100px 1fr 100px 180px', padding:'11px 18px', background:'var(--bg-secondary)', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.6px', textTransform:'uppercase', gap:8 }}>
          <span>ID</span><span>Name</span><span>Sterne</span><span>Nachricht</span><span>Datum</span><span>Aktion</span>
        </div>

        {loading && (
          <div style={{ padding:'48px 0', textAlign:'center', color:'var(--text-muted)', fontSize:14 }}>⏳ Lädt…</div>
        )}

        {!loading && reviews.length === 0 && (
          <div style={{ padding:'48px 0', textAlign:'center', color:'var(--text-muted)', fontSize:14 }}>
            {tab==='published' ? '💬 Noch keine veröffentlichten Bewertungen.' : '✅ Keine ausstehenden Bewertungen.'}
          </div>
        )}

        {!loading && reviews.map((r, idx) => (
          <div key={r.id} style={{
            display:'grid',
            gridTemplateColumns:tab==='published'?'120px 150px 100px 1fr 100px 120px':'120px 150px 100px 1fr 100px 180px',
            padding:'14px 18px',
            borderBottom:idx<reviews.length-1?'1px solid var(--border)':'none',
            background:busy===r.id?'var(--bg-hover)':'transparent',
            opacity:busy===r.id?0.6:1,
            transition:'background 0.15s, opacity 0.2s',
            alignItems:'center',
            gap:8,
          }}>
            <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.id}>
              {r.id.slice(0,10)}…
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent)', opacity:.85, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#0F1117', flexShrink:0 }}>
                {(r.name||'?').charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</span>
            </div>
            <StarDisplay stars={r.stars} />
            <span style={{ fontSize:12.5, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.message}>
              {r.message}
            </span>
            <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{r.date||'—'}</span>
            <div style={{ display:'flex', gap:6 }}>
              {tab==='pending' && (
                <button onClick={() => handlePublish(r.id)} disabled={!!busy} style={{ padding:'6px 11px', borderRadius:7, border:'none', background:'var(--accent)', color:'#0F1117', fontSize:11, fontWeight:700, cursor:busy?'not-allowed':'pointer', fontFamily:'var(--font-body)', whiteSpace:'nowrap' }}>
                  ✅ Live
                </button>
              )}
              <button
                onClick={() => tab==='published' ? setConfirmId(r.id) : handleReject(r.id)}
                disabled={!!busy}
                style={{ padding:'6px 11px', borderRadius:7, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', color:'#EF4444', fontSize:11, fontWeight:700, cursor:busy?'not-allowed':'pointer', fontFamily:'var(--font-body)', whiteSpace:'nowrap' }}
              >
                🗑️ {tab==='published'?'Löschen':'Ablehnen'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:16, fontSize:11.5, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6 }}>
        <span>💡</span>
        <span>Änderungen werden sofort auf <strong>be-hui.com</strong> wirksam.</span>
      </div>
    </DashboardLayout>
  );
}
