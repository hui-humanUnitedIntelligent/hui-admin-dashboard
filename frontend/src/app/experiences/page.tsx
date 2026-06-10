// frontend/src/app/experiences/page.tsx
'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Badge from '@/components/ui/Badge';

// ── Types ──────────────────────────────────────────────────────────────────
type TabKey = 'all' | 'pending' | 'published' | 'rejected' | 'draft' | 'flagged' | 'deleted' | 'sensitive';

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('de-DE'); }

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'published')      return <Badge variant="success" dot>Published</Badge>;
  if (status === 'pending_review') return <Badge variant="warning" dot>⏳ Eingereicht</Badge>;
  if (status === 'rejected')       return <Badge variant="danger"  dot>❌ Abgelehnt</Badge>;
  if (status === 'draft')          return <Badge variant="neutral" dot>Draft</Badge>;
  if (status === 'flagged')        return <Badge variant="danger"  dot>⚑ Gemeldet</Badge>;
  if (status === 'deleted')        return <Badge variant="neutral">🗑 Gelöscht</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

void StatusBadge; // used later when Supabase data is connected

// ── Tab Bar ────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, counts }: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  counts: Record<TabKey, number>;
}) {
  const tabs: { key: TabKey; label: string; icon: string; danger?: boolean }[] = [
    { key: 'all',       label: 'Alle',        icon: ''   },
    { key: 'pending',   label: 'Eingereicht', icon: '⏳', danger: false },
    { key: 'published', label: 'Published',   icon: '●'  },
    { key: 'rejected',  label: 'Abgelehnt',   icon: '✕', danger: true  },
    { key: 'draft',     label: 'Draft',       icon: ''   },
    { key: 'flagged',   label: 'Gemeldet',    icon: '⚑', danger: true  },
    { key: 'deleted',   label: 'Gelöscht',    icon: '🗑' },
    { key: 'sensitive', label: 'Sensitiv',    icon: '⚠️', danger: true  },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap' }}>
      {tabs.map(({ key, label, icon, danger }) => {
        const active = tab === key;
        const cnt    = counts[key];
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400,
              border: `1px solid ${active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : 'var(--border)'}`,
              background: active ? (key === 'pending' ? 'rgba(245,158,11,0.12)' : danger ? 'var(--red-dim)' : 'var(--accent-dim)') : 'var(--bg-secondary)',
              color: active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
            {label}
            {cnt > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700,
                background: active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--bg-tertiary)'),
                color: active ? '#fff' : (key === 'pending' || danger ? '#fff' : 'var(--text-secondary)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>{cnt}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ErlebnisseProjektePage() {
  const [tab,    setTab]    = useState<TabKey>('all');
  const [search, setSearch] = useState('');

  void search; // wird für Filterlogik verwendet sobald Supabase angebunden ist

  // Platzhalter-Counts — werden durch Supabase-Hooks ersetzt
  const counts: Record<TabKey, number> = {
    all: 0, pending: 0, published: 0, rejected: 0,
    draft: 0, flagged: 0, deleted: 0, sensitive: 0,
  };

  // Context-Banner pro Tab — identisch zu Works
  const tabBanners: Partial<Record<TabKey, { bg: string; border: string; color: string; text: string }>> = {
    pending:   { bg: 'rgba(245,158,11,0.08)',  border: '#F59E0B',       color: '#F59E0B',       text: '⏳ Eingereichte Erlebnisse & Projekte warten auf Freigabe.' },
    rejected:  { bg: 'rgba(255,107,107,0.06)', border: 'var(--red)',    color: 'var(--red)',    text: '❌ Abgelehnte Einträge. Nutzer können sie überarbeiten und erneut einreichen.' },
    deleted:   { bg: 'rgba(255,107,107,0.06)', border: 'var(--red)',    color: 'var(--red)',    text: '🗑 Hier siehst du gelöschte Einträge. Du kannst sie als Draft wiederherstellen.' },
    flagged:   { bg: 'rgba(247,183,49,0.08)',  border: 'var(--gold)',   color: 'var(--gold)',   text: '⚑ Gemeldete Einträge sind versteckt. Du kannst die Meldung auflösen oder den Eintrag löschen.' },
    sensitive: { bg: 'rgba(255,107,107,0.06)', border: 'var(--red)',    color: 'var(--red)',    text: '⚠️ Einträge mit verdächtigen Keywords oder fehlenden Informationen. Bitte prüfen.' },
  };

  const banner = tabBanners[tab];

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
    outline: 'none', fontFamily: 'var(--font-body)',
  };

  const TABLE_COLS = ['Titel', 'Kategorie', 'Status', 'Preis / Wert', 'Engagement', 'Erstellt', 'Aktionen'];

  return (
    <DashboardLayout
      title="Erlebnisse & Projekte"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {counts.pending > 0 && (
            <button onClick={() => setTab('pending')} style={{ fontSize: 11, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', padding: '3px 10px', borderRadius: 20, border: '1px solid #F59E0B', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              ⏳ {counts.pending} eingereicht
            </button>
          )}
          {counts.flagged > 0 && (
            <button onClick={() => setTab('flagged')} style={{ fontSize: 11, background: 'var(--red-dim)', color: 'var(--red)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--red)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              ⚑ {counts.flagged} gemeldet
            </button>
          )}
          {counts.sensitive > 0 && (
            <button onClick={() => setTab('sensitive')} style={{ fontSize: 11, background: 'var(--gold-dim)', color: 'var(--gold)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--gold)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              ⚠️ {counts.sensitive} sensitiv
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(81,207,102,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(81,207,102,0.2)' }}>● Live</span>
          <button style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }} className="grid-6">
        {[
          { label: 'Gesamt',       value: fmt(counts.published + counts.draft), color: 'var(--accent)'     },
          { label: 'Published',    value: fmt(counts.published),                color: 'var(--green)'      },
          { label: 'Draft',        value: fmt(counts.draft),                    color: 'var(--gold)'       },
          { label: 'Eingereicht',  value: fmt(counts.pending),                  color: '#F59E0B'           },
          { label: 'Gemeldet',     value: fmt(counts.flagged),                  color: 'var(--red)'        },
          { label: 'Gelöscht',     value: fmt(counts.deleted),                  color: 'var(--text-muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Tab Bar ── */}
      <TabBar tab={tab} setTab={setTab} counts={counts} />

      {/* ── Context Banner ── */}
      {banner && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: banner.bg, border: `1px solid ${banner.border}`, borderRadius: 8, fontSize: 12, color: banner.color }}>
          {banner.text}
        </div>
      )}

      {/* ── Search ── */}
      <div style={{ marginBottom: 12, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12 }}>🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`In ${tab === 'deleted' ? 'gelöschten' : tab === 'flagged' ? 'gemeldeten' : 'allen'} Einträgen suchen…`}
          style={{ ...fieldStyle, paddingLeft: 30, boxSizing: 'border-box' }}
        />
      </div>

      {/* ── Tabelle ── */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1fr 1fr',
          padding: '9px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-primary)',
        }}>
          {TABLE_COLS.map(col => (
            <div key={col} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {col}
            </div>
          ))}
        </div>

        {/* Leerer Zustand */}
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🌿</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Noch keine Daten
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
            Dieser Bereich wird bald mit Erlebnissen, Projekten und Initiativen aus Supabase befüllt.
          </div>
          <div style={{ marginTop: 16, display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['experiences', 'projects', 'initiatives'].map(t => (
              <span key={t} style={{
                padding: '4px 12px', borderRadius: 99,
                background: 'rgba(78,205,196,0.08)',
                border: '1px solid rgba(78,205,196,0.20)',
                color: 'var(--accent)', fontSize: 11, fontWeight: 600,
              }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Info-Hinweis ── */}
      <div style={{
        marginTop: 14,
        background: 'rgba(251,191,36,0.06)',
        border: '1px solid rgba(251,191,36,0.20)',
        borderRadius: 10, padding: '11px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>ℹ️</span>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: '#FBBF24' }}>Vorbereitet für:</strong>
          {' '}Tabellen <code>experiences</code>, <code>projects</code> und <code>initiatives</code> aus Supabase.
          Alle Tabs, Filter und KPI-Kacheln folgen der Werke & Content Architektur.
        </div>
      </div>

    </DashboardLayout>
  );
}
