// frontend/src/components/views/ScoreFailuresView.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Vordefinierte Ablehnungsgründe" — Projekte die den KI-Score nicht erreicht haben
// Datenquelle: impact_score_failures (Supabase)
// Superadmin-only
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/api';

interface ScoreFailure {
  id: string;
  user_id: string | null;
  project_name: string;
  short_desc: string | null;
  problem: string | null;
  umsetzung: string | null;
  kategorie: string | null;
  funding_goal: number | null;
  ai_score: number;
  grund: string;
  created_at: string;
}

const GRUND_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  zu_kurz:      { label: 'Zu kurz',           emoji: '✏️',  color: '#f97316' },
  zu_vage:      { label: 'Zu vage',            emoji: '🔍',  color: '#f59e0b' },
  persoenlich:  { label: 'Persönlicher Nutzen', emoji: '🚫',  color: '#ef4444' },
  kommerziell:  { label: 'Kommerziell',         emoji: '💼',  color: '#8b5cf6' },
  kein_hui_bezug:{ label: 'Kein HUI-Bezug',    emoji: '🎯',  color: '#6b7280' },
};


// ── Session-Token-Helper ──────────────────────────────────────────────────────
function getSessionToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    // Supabase speichert die Session unter 'sb-<project-ref>-auth-token'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = JSON.parse(localStorage.getItem(key) || '{}');
        return val?.access_token || '';
      }
    }
  } catch { /* ignore */ }
  return '';
}
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFailures(): Promise<ScoreFailure[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/impact_score_failures?select=*&order=created_at.desc&limit=500`,
    { headers: { apikey: SUPABASE_ANON } }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function softDeleteFailure(id: string): Promise<void> {
  const res = await fetch('/api/employee/reasons/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function hardDeleteFailure(id: string): Promise<void> {
  const res = await fetch(`/api/admin/reasons/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
       + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 45 ? '#22c55e' : score >= 30 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 99, transition: 'width 0.8s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 36 }}>{score}/100</span>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ f, onClose }: { f: ScoreFailure; onClose: () => void }) {
  const g = GRUND_LABELS[f.grund] || { label: f.grund, emoji: '❓', color: '#6b7280' };
  const row = (label: string, value: React.ReactNode) => value ? (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#1e293b' }}>{value}</span>
    </div>
  ) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>{f.project_name}</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${g.color}15`, color: g.color, border: `1px solid ${g.color}30` }}>
              {g.emoji} {g.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', padding: 4 }}>✕</button>
        </div>

        {/* Score */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>HUI-Fit-Score</div>
          <ScoreBar score={f.ai_score} />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Schwelle für Einreichung: 45/100</div>
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
          {row('Kurzbeschreibung', f.short_desc)}
          {row('Problem', f.problem)}
          {row('Umsetzung', f.umsetzung)}
          {row('Kategorie', f.kategorie)}
          {row('Förderbedarf', f.funding_goal ? `€ ${f.funding_goal.toLocaleString('de-DE')}` : null)}
          {row('User-ID', f.user_id ? <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.user_id}</span> : 'Anonym')}
          {row('Eingereicht', fmtDate(f.created_at))}
        </div>
      </div>
    </div>
  );
}

// ── Hauptansicht ──────────────────────────────────────────────────────────────
export default function ScoreFailuresView() {
  const [failures, setFailures]   = useState<ScoreFailure[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<ScoreFailure | null>(null);
  const [filterGrund, setFilter]  = useState<string>('all');
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFailures(await fetchFailures());
    } catch (e) {
      showToast('Fehler beim Laden', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const [deletingId, setDeletingId] = useState<string|null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm('Diesen Eintrag löschen?')) return;
    setDeletingId(id);
    try {
      await softDeleteFailure(id);
      setFailures(prev => prev.map(f => f.id===id ? { ...f, status: 'deleted' } : f));
      showToast('Eintrag gelöscht (Soft-Delete)', 'success');
    } catch { showToast('Fehler beim Löschen', 'error'); }
    finally { setDeletingId(null); }
  };

  const handleHardDelete = async (id: string) => {
    if (!confirm('⚠️ Endgültig löschen? Diese Aktion ist irreversibel!')) return;
    setDeletingId(id);
    try {
      await hardDeleteFailure(id);
      setFailures(prev => prev.filter(f => f.id !== id));
      showToast('Endgültig gelöscht', 'success');
    } catch { showToast('Fehler beim endgültigen Löschen', 'error'); }
    finally { setDeletingId(null); }
  };

  // Filter + Search
  const filtered = failures.filter(f => {
    const fStatus = (f as ScoreFailure & { status?: string }).status;
    if (!showDeleted && fStatus === 'deleted') return false;
    if (showDeleted && fStatus !== 'deleted') return false;
    const matchGrund = filterGrund === 'all' || f.grund === filterGrund;
    const q = search.toLowerCase();
    const matchSearch = !q || f.project_name.toLowerCase().includes(q)
      || (f.short_desc || '').toLowerCase().includes(q)
      || (f.user_id || '').toLowerCase().includes(q);
    return matchGrund && matchSearch;
  });

  // KPIs
  const counts = Object.fromEntries(
    Object.keys(GRUND_LABELS).map(g => [g, failures.filter(f => f.grund === g).length])
  );
  const avgScore = failures.length ? Math.round(failures.reduce((s, f) => s + f.ai_score, 0) / failures.length) : 0;

  return (
    <DashboardLayout title="Vordefinierte Ablehnungsgründe">
      {selected && <DetailModal f={selected} onClose={() => setSelected(null)} />}

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>🔍</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>
              Vordefinierte Ablehnungsgründe
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
            Projekte, die den KI-Score nicht erreicht haben (Schwelle: 45/100) — vor der Admin-Prüfung automatisch gefiltert.
          </p>
        </div>

        {/* Tabs: Aktiv / Gelöscht */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setShowDeleted(false)} style={{ padding:'6px 16px', borderRadius:20, border:'1px solid var(--border)', background:!showDeleted?'var(--accent)':'transparent', color:!showDeleted?'#0f1117':'var(--text-muted)', fontWeight:600, fontSize:12, cursor:'pointer' }}>Aktiv</button>
          <button onClick={() => setShowDeleted(true)}  style={{ padding:'6px 16px', borderRadius:20, border:'1px solid var(--border)', background:showDeleted?'var(--accent)':'transparent', color:showDeleted?'#0f1117':'var(--text-muted)', fontWeight:600, fontSize:12, cursor:'pointer' }}>🗑 Gelöscht</button>
        </div>

        {/* KPI-Karten */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)' }}>{failures.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>Gesamt abgelehnt</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>{avgScore}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>Ø Score</div>
          </div>
          {Object.entries(GRUND_LABELS).map(([key, { label, emoji, color }]) => (
            <div key={key} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)', cursor: 'pointer', outline: filterGrund === key ? `2px solid ${color}` : 'none' }}
              onClick={() => setFilter(filterGrund === key ? 'all' : key)}>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{counts[key] ?? 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{emoji} {label}</div>
            </div>
          ))}
        </div>

        {/* Filter + Suche */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Suchen (Projektname, User-ID …)"
            style={{ flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13 }}
          />
          <select value={filterGrund} onChange={e => setFilter(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13 }}>
            <option value="all">Alle Gründe</option>
            {Object.entries(GRUND_LABELS).map(([k, { label, emoji }]) => (
              <option key={k} value={k}>{emoji} {label}</option>
            ))}
          </select>
          <button onClick={load} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            🔄 Aktualisieren
          </button>
        </div>

        {/* Tabelle */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Lade Daten …</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Keine KI-Ablehnungen</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Alle bisherigen Projekte haben den Score erreicht oder es gibt noch keine Daten.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(f => {
              const g = GRUND_LABELS[f.grund] || { label: f.grund, emoji: '❓', color: '#6b7280' };
              return (
                <div key={f.id}
                  onClick={() => setSelected(f)}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderLeft: `4px solid ${g.color}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{f.project_name}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: `${g.color}15`, color: g.color, border: `1px solid ${g.color}25` }}>
                        {g.emoji} {g.label}
                      </span>
                      {f.kategorie && (
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>
                          {f.kategorie}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
                      {(f.short_desc || 'Keine Beschreibung').slice(0, 100)}{(f.short_desc || '').length > 100 ? '…' : ''}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ width: 140 }}><ScoreBar score={f.ai_score} /></div>
                      {f.funding_goal && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔥 € {f.funding_goal.toLocaleString('de-DE')}</span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📅 {fmtDate(f.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <button onClick={e => { e.stopPropagation(); handleDelete(f.id); }}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      🗑 Löschen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
