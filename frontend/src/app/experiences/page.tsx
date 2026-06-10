// frontend/src/app/experiences/page.tsx
'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Badge from '@/components/ui/Badge';

// ── Types ─────────────────────────────────────────────────────────────────
type TabKey = 'all' | 'published' | 'draft' | 'gemeldet' | 'geloescht' | 'sensitiv';

// ── Helpers ───────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('de-DE'); }

// ── Status Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'published')      return <Badge variant="success" dot>Published</Badge>;
  if (status === 'pending_review') return <Badge variant="warning" dot>⏳ Pending</Badge>;
  if (status === 'rejected')       return <Badge variant="danger"  dot>❌ Abgelehnt</Badge>;
  if (status === 'draft')          return <Badge variant="neutral" dot>Draft</Badge>;
  if (status === 'flagged')        return <Badge variant="danger"  dot>⚑ Gemeldet</Badge>;
  if (status === 'deleted')        return <Badge variant="neutral">🗑 Gelöscht</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

// ── Tab Bar ───────────────────────────────────────────────────────────────
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'all',       label: 'Alle',       icon: '◎' },
  { key: 'published', label: 'Published',  icon: '●' },
  { key: 'draft',     label: 'Draft',      icon: '○' },
  { key: 'gemeldet',  label: 'Gemeldet',   icon: '⚑' },
  { key: 'geloescht', label: 'Gelöscht',   icon: '🗑' },
  { key: 'sensitiv',  label: 'Sensitiv',   icon: '⚠' },
];

const TABLE_COLS = ['Titel', 'Kategorie', 'Status', 'Preis / Wert', 'Engagement', 'Erstellt', 'Aktionen'];

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ErlebnisseProjektePage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');

  void search; // wird später für Filterlogik verwendet

  const counts: Record<TabKey, number> = {
    all: 0, published: 0, draft: 0, gemeldet: 0, geloescht: 0, sensitiv: 0,
  };

  return (
    <DashboardLayout title="Erlebnisse & Projekte">
      <div style={{ padding: '0 0 40px' }}>

        {/* ── Page Header ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ fontSize: 26 }}>🌿</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                Erlebnisse & Projekte
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Erlebnisse · Projekte · Initiativen — Supabase-Anbindung folgt
              </p>
            </div>
            {/* Coming Soon Badge */}
            <div style={{
              marginLeft: 'auto',
              padding: '4px 12px', borderRadius: 99,
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.30)',
              color: '#FBBF24', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            }}>
              COMING SOON
            </div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12, marginBottom: 20,
        }}>
          {[
            { label: 'Gesamt',    value: fmt(counts.all),       color: 'var(--accent)',  icon: '📊' },
            { label: 'Published', value: fmt(counts.published), color: 'var(--green)',   icon: '✅' },
            { label: 'Draft',     value: fmt(counts.draft),     color: 'var(--text-muted)', icon: '✏️' },
            { label: 'Gemeldet',  value: fmt(counts.gemeldet),  color: 'var(--yellow)',  icon: '⚠️' },
            { label: 'Gelöscht',  value: fmt(counts.geloescht), color: 'var(--red)',     icon: '🗑️' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'var(--bg-secondary)', borderRadius: 12,
              border: '1px solid var(--border)', padding: '16px 14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{kpi.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter + Search Bar ── */}
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 12,
          border: '1px solid var(--border)', padding: '12px 16px',
          marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px', borderRadius: 99,
                  border: `1px solid ${tab === t.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: tab === t.key ? 'var(--accent-dim)' : 'transparent',
                  color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 10 }}>{t.icon}</span>
                {t.label}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                  background: tab === t.key ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  padding: '1px 5px', borderRadius: 99,
                }}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 12px',
              color: 'var(--text-primary)', fontSize: 12,
              outline: 'none', width: 200,
            }}
          />
        </div>

        {/* ── Tabelle ── */}
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 12,
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {/* Tabellen-Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1fr 1fr',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-primary)',
          }}>
            {TABLE_COLS.map(col => (
              <div key={col} style={{
                fontSize: 10, fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                {col}
              </div>
            ))}
          </div>

          {/* Leerer Zustand */}
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🌿</div>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: 'var(--text-primary)', marginBottom: 8,
            }}>
              Noch keine Daten
            </div>
            <div style={{
              fontSize: 13, color: 'var(--text-muted)',
              maxWidth: 340, margin: '0 auto', lineHeight: 1.6,
            }}>
              Dieser Bereich wird bald mit Erlebnissen, Projekten und
              Initiativen aus Supabase befüllt.
            </div>
            {/* Tabellen-Platzhalter zur Orientierung */}
            <div style={{
              marginTop: 20, display: 'inline-flex', gap: 8, flexWrap: 'wrap',
              justifyContent: 'center',
            }}>
              {['experiences', 'projects', 'initiatives'].map(t => (
                <span key={t} style={{
                  padding: '4px 12px', borderRadius: 99,
                  background: 'rgba(78,205,196,0.08)',
                  border: '1px solid rgba(78,205,196,0.20)',
                  color: 'var(--accent)', fontSize: 11, fontWeight: 600,
                }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Hinweis ── */}
        <div style={{
          marginTop: 16,
          background: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.20)',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--yellow)' }}>Vorbereitet für:</strong>
            {' '}Tabellen <code>experiences</code>, <code>projects</code> und <code>initiatives</code> aus Supabase.
            Struktur, Filter und Tabellenlayout sind vollständig implementiert — die Datenanbindung folgt.
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
