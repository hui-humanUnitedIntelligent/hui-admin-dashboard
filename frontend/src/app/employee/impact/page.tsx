// frontend/src/app/employee/impact/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/hooks/useAuth';

/* ── Typen ── */
interface ImpactProject {
  id: string; name: string; category: string | null; description: string | null;
  icon: string | null; color: string | null; status: string;
  votes: number; live_votes: number; month: string | null;
  awarded_eur: number | null; contact_name: string | null;
  tags: string[] | null; created_at: string; distributed_at: string | null;
}
interface PoolData {
  latest: { state: string; voting_ends_at: string | null; month: string } | null;
  totalEur: number; distributedEur: number; awardedEur: number;
  openEur: number; totalVotes: number;
  bruttoPool: number; nettoImpact: number; firmenanteil: number;
}

/* ── Hilfs-Funktionen ── */
function fmtEur(n: number | null | undefined): string {
  const v = n ?? 0;
  return `\u20ac${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  voting:   { label: 'Voting',    bg: 'rgba(116,192,252,0.15)', color: '#74C0FC' },
  active:   { label: 'Aktiv',     bg: 'rgba(81,207,102,0.15)',  color: '#51CF66' },
  won:      { label: 'Gewonnen',  bg: 'rgba(255,212,59,0.15)',  color: '#ffd43b' },
  archived: { label: 'Archiviert',bg: 'rgba(134,142,150,0.15)',color: 'var(--text-muted)' },
  rejected: { label: 'Abgelehnt', bg: 'rgba(255,107,107,0.15)',color: '#ff6b6b' },
};

/* ── Haupt-Komponente ── */
export default function ImpactPage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [projects, setProjects] = useState<ImpactProject[]>([]);
  const [pool,     setPool]     = useState<PoolData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<string>('all');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<ImpactProject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Projekte + Live-Votes + Aggregate (awardedEur/totalVotes) kommen aus
      // /api/impact-projects (SSOT fuer impact_projects + impact_votes).
      // Pool-Finanzen (Stripe-basiert, ARCH-006.1) kommen separat aus /api/impact?type=overview.
      // Vorher rief diese Seite faelschlich nur /api/impact (Default type=overview) auf,
      // das liefert nie 'projects'/'pool' -- Projekte waren dauerhaft leer, Finanz-Kacheln
      // dauerhaft €0,00.
      const params = new URLSearchParams({ limit: '200' });
      if (filter !== 'all') params.set('status', filter);

      const [projRes, overviewRes] = await Promise.all([
        fetch(`/api/impact-projects?${params}`, { credentials: 'include' }),
        fetch('/api/impact?type=overview', { credentials: 'include' }),
      ]);
      if (!projRes.ok) throw new Error(`HTTP ${projRes.status} (impact-projects)`);
      if (!overviewRes.ok) throw new Error(`HTTP ${overviewRes.status} (impact overview)`);

      const projData = await projRes.json();
      const ov        = await overviewRes.json();

      setProjects(Array.isArray(projData.projects) ? projData.projects : []);
      setPool({
        latest: ov.poolMonth ? { state: ov.poolState, voting_ends_at: null, month: ov.poolMonth } : null,
        totalEur:       ov.bruttoPool ?? 0,
        distributedEur: ov.distributed ?? 0,
        awardedEur:     projData.awardedEur ?? 0,
        openEur:        ov.openImpact ?? 0,
        totalVotes:     projData.totalVotes ?? 0,
        bruttoPool:     ov.bruttoPool ?? 0,
        nettoImpact:    ov.nettoImpact ?? 0,
        firmenanteil:   ov.firmenanteil ?? 0,
      });
    } catch (e) {
      console.error('[impact]', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-Refresh alle 30s
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = projects.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  // Status-Counts
  const counts: Record<string, number> = {};
  for (const p of projects) counts[p.status] = (counts[p.status] ?? 0) + 1;

  const kpiCard = (label: string, value: string, icon: string, color: string) => (
    <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  );

  const statusBtn = (key: string, label: string) => (
    <button key={key} onClick={() => setFilter(key)} style={{
      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: `1px solid ${filter === key ? 'var(--accent)' : 'var(--border)'}`,
      background: filter === key ? 'rgba(78,205,196,0.15)' : 'var(--bg-secondary)',
      color: filter === key ? 'var(--accent)' : 'var(--text-muted)',
    }}>
      {label}{key !== 'all' && counts[key] !== undefined ? ` (${counts[key]})` : ` (${projects.length})`}
    </button>
  );

  return (
    <EmployeeLayout title="Impact Pool">
      <PageHeader title="Impact Pool" subtitle="15\u00a0% jedes Umsatzes gehen in den gemeinsamen Impact-Pool"
        actionsRole={userRole as 'superadmin' | 'employee'} userRole={userRole}
        actions={<button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>\u21ba Refresh</button>}
      />

      {/* Finanz-KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {pool ? (
          <>
            {kpiCard('Gesamtumsatz',    fmtEur(pool.totalEur / 0.15), '\uD83D\uDCB0', 'var(--text-primary)')}
            {kpiCard('Brutto-Pool (15%)',fmtEur(pool.bruttoPool),      '\uD83C\uDF31', '#74C0FC')}
            {kpiCard('Netto-Impact (85%)',fmtEur(pool.nettoImpact),    '\uD83C\uDF1F', '#51CF66')}
            {kpiCard('Firmenanteil (15%)',fmtEur(pool.firmenanteil),   '\uD83C\uDFE2', '#ffd43b')}
          </>
        ) : (
          <>
            {kpiCard('Gesamtumsatz',    '\u20ac0,00', '\uD83D\uDCB0', 'var(--text-primary)')}
            {kpiCard('Brutto-Pool (15%)','\u20ac0,00', '\uD83C\uDF31', '#74C0FC')}
            {kpiCard('Netto-Impact (85%)','\u20ac0,00','\uD83C\uDF1F', '#51CF66')}
            {kpiCard('Firmenanteil (15%)','\u20ac0,00', '\uD83C\uDFE2', '#ffd43b')}
          </>
        )}
      </div>

      {/* Pool-Details */}
      {pool && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {kpiCard('Vergeben',   fmtEur(pool.awardedEur),    '\uD83C\uDFC6', '#51CF66')}
          {kpiCard('Offen',      fmtEur(pool.openEur),       '\u23F3',        '#F7B731')}
          {kpiCard('Total Votes',String(pool.totalVotes),    '\uD83D\uDDF3\uFE0F', '#B197FC')}
          {pool.latest && kpiCard('Pool-Status', pool.latest.state, '\uD83D\uDCCA', 'var(--accent)')}
        </div>
      )}

      {/* Filter-Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {statusBtn('all',      'Alle')}
        {statusBtn('voting',   'Voting')}
        {statusBtn('active',   'Aktiv')}
        {statusBtn('won',      'Gewonnen')}
        {statusBtn('archived', 'Archiviert')}
        {statusBtn('rejected', 'Abgelehnt')}
      </div>

      {/* Suche */}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="\uD83D\uDD0D Projekt suchen..."
          style={{ width: '100%', maxWidth: 360, padding: '8px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* Projekt-Liste */}
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Impact Projekte ({projects.length})</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Object.entries(counts).map(([s,c]) => `${c} ${s}`).join(' · ')}</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Lade Impact Pool...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Keine Projekte gefunden.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => {
            const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.archived;
            return (
              <div key={p.id}
                onClick={() => setSelected(p)}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              >
                {/* Icon */}
                {p.icon ? (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: p.color ?? 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{p.icon}</div>
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: p.color ?? 'var(--accent)', flexShrink: 0 }} />
                )}
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.category} &middot; {p.live_votes ?? p.votes} Votes
                    {p.awarded_eur ? ` \u00b7 ${fmtEur(p.awarded_eur)} vergeben` : ''}
                    {p.month ? ` \u00b7 ${p.month}` : ''}
                  </div>
                </div>
                {/* Status-Badge */}
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, flexShrink: 0 }}>{sc.label}</span>
                {userRole === 'superadmin' && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtTime(p.created_at)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail-Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSelected(null)}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 540, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: selected.color ?? 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {selected.icon ?? '\uD83C\uDF31'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.category} &middot; {selected.month}</div>
              </div>
              <span style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: (STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.archived).bg, color: (STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.archived).color }}>
                {(STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.archived).label}
              </span>
            </div>
            {selected.description && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>{selected.description}</p>
            )}
            {[
              ['Votes (live)',   String(selected.live_votes ?? selected.votes)],
              ['Vergeben',       fmtEur(selected.awarded_eur)],
              ['Kontakt',        selected.contact_name ?? '\u2014'],
              ['Erstellt',       fmtTime(selected.created_at)],
              ['Verteilt am',    fmtTime(selected.distributed_at)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {(selected.tags ?? []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>TAGS</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(selected.tags ?? []).map(t => (
                    <span key={t} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              Nur Ansicht \u2014 Status\u00e4nderungen erfolgen im Superadmin-Bereich.
            </div>
            <button onClick={() => setSelected(null)} style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
              Schlie\u00dfen
            </button>
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
}
