// frontend/src/app/startphase/page.tsx
// HUI Admin Dashboard — HUI Startphase Übersicht
// Bewerbungen für die HUI Startphase verwalten
'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

interface Application {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  interest: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  contributions: string[];
  about_you?: string;
}

interface Stats {
  new: number;
  review: number;
  question: number;
  accepted: number;
  rejected: number;
  completed: number;
  total: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:        { label: 'Neu',            color: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.12)' },
  review:     { label: 'In Prüfung',      color: '#F5A623', bg: 'rgba(245, 166, 35, 0.12)' },
  question:   { label: 'Rückfrage',       color: '#E67E22', bg: 'rgba(230, 126, 34, 0.12)' },
  accepted:   { label: 'Angenommen',      color: '#27AE60', bg: 'rgba(39, 174, 96, 0.12)' },
  rejected:   { label: 'Nicht ausgewählt', color: '#E74C3C', bg: 'rgba(231, 76, 60, 0.12)' },
  completed:  { label: 'Abgeschlossen',   color: '#7F8C8D', bg: 'rgba(127, 140, 141, 0.12)' },
};

const INTEREST_LABELS: Record<string, string> = {
  idea: 'Eine Idee',
  talent: 'Ein Talent',
  experience: 'Erfahrung',
  time: 'Zeit',
  support: 'Unterstützung',
  curiosity: 'Neugier',
  project: 'Projekt',
  work: 'Werk',
  pioneer: 'Pionier',
  connector: 'Verbinden',
  explore: 'Kennenlernen',
  other: 'Anderes',
};

const FILTERS = [
  { value: 'all',       label: 'Alle' },
  { value: 'new',       label: 'Neu' },
  { value: 'review',    label: 'In Prüfung' },
  { value: 'question',  label: 'Rückfrage' },
  { value: 'accepted',  label: 'Angenommen' },
  { value: 'rejected',  label: 'Nicht ausgewählt' },
  { value: 'completed', label: 'Abgeschlossen' },
];

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 18,
};

function StatTile({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ ...card, padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: color, opacity: 0.6,
      }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function StartphasePage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats>({ new: 0, review: 0, question: 0, accepted: 0, rejected: 0, completed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('filter', filter);
      if (search) params.set('search', search);
      params.set('limit', '100');

      const res = await fetch(`/api/startphase/applications?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) {
        setApplications(json.data.applications ?? []);
        setStats(json.data.stats ?? stats);
        setTotal(json.data.total ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  return (
    <DashboardLayout title="HUI Admin — Startphase">
      <PageHeader
        title="HUI Startphase"
        subtitle="Bewerbungen für die frühe HUI-Phase verwalten"
        breadcrumbs={[
          { label: 'Management', href: '/users' },
          { label: 'HUI Startphase' },
        ]}
        actions={
          <button
            onClick={fetchApplications}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: '#0F1117',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Lädt…' : 'Aktualisieren'}
          </button>
        }
      />

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        <StatTile label="Neu" value={stats.new} color="#4ECDC4" bg="rgba(78, 205, 196, 0.12)" />
        <StatTile label="In Prüfung" value={stats.review} color="#F5A623" bg="rgba(245, 166, 35, 0.12)" />
        <StatTile label="Rückfragen" value={stats.question} color="#E67E22" bg="rgba(230, 126, 34, 0.12)" />
        <StatTile label="Angenommen" value={stats.accepted} color="#27AE60" bg="rgba(39, 174, 96, 0.12)" />
        <StatTile label="Nicht ausgewählt" value={stats.rejected} color="#E74C3C" bg="rgba(231, 76, 60, 0.12)" />
        <StatTile label="Abgeschlossen" value={stats.completed} color="#7F8C8D" bg="rgba(127, 140, 141, 0.12)" />
        <StatTile label="Gesamt" value={stats.total} color="#9B59B6" bg="rgba(155, 89, 186, 0.12)" />
      </div>

      {/* Filter + Search */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: `1px solid ${filter === f.value ? 'var(--accent)' : 'var(--border)'}`,
                background: filter === f.value ? 'var(--accent-dim)' : 'transparent',
                color: filter === f.value ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Name oder E-Mail suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            maxWidth: 300,
            padding: '8px 14px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>E-Mail</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Interesse</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Eingang</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Letzte Aktivität</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Lädt…</td></tr>
              ) : applications.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Keine Bewerbungen gefunden</td></tr>
              ) : (
                applications.map(app => (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {app.first_name} {app.last_name}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {app.email}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {app.interest ? (INTEREST_LABELS[app.interest] || app.interest) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusBadge status={app.status} />
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {fmtDate(app.created_at)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {fmtDate(app.updated_at)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <a
                        href={`/startphase/${app.id}`}
                        style={{
                          display: 'inline-block',
                          padding: '5px 12px',
                          background: 'var(--accent-dim)',
                          color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        Öffnen →
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          {applications.length} von {total} Bewerbungen
        </div>
      )}
    </DashboardLayout>
  );
}
