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
  innovationFund: number; flexPool: number;
}

/* ── Voting Types ── */
interface VotingRankingEntry {
  project_id: string;
  project_name: string;
  short_desc: string | null;
  funding_goal: number;
  current_amount: number;
  vote_count: number;
  rank: number | null;
  share_pct: number | null;
  is_completed: boolean;
  status: string;
  applicant_name: string | null;
  contact_email: string | null;
  created_at: string | null;
  reviewed_at: string | null;
}
interface VotingRankingResponse {
  ok: boolean;
  ranking: VotingRankingEntry[];
  month_total_eur: number;
  month_by_project: Record<string, number>;
  grand_total_eur: number;
  total_by_project: Record<string, number>;
  pool_month: string;
}
interface MonthEntry { month: string; total: number; entries: number }
interface DistEntry {
  id: string; order_id: string; project_id: string; rank_at_time: number;
  share_pct: number; amount_eur: number; pool_month: string; distributed_at: string;
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
function fmtMonthLabel(m: string): string {
  const [y, mo] = m.split('-');
  const names = ['','Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${names[parseInt(mo)] ?? mo} ${y}`;
}
function rankMedal(r: number | null): string {
  if (r === 1) return '🥇';
  if (r === 2) return '🥈';
  if (r === 3) return '🥉';
  return `#${r ?? '—'}`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  voting:   { label: 'Voting',    bg: 'rgba(116,192,252,0.15)', color: '#74C0FC' },
  active:   { label: 'Aktiv',     bg: 'rgba(81,207,102,0.15)',  color: '#51CF66' },
  won:      { label: 'Gewonnen',  bg: 'rgba(255,212,59,0.15)',  color: '#ffd43b' },
  archived: { label: 'Archiviert',bg: 'rgba(134,142,150,0.15)',color: 'var(--text-muted)' },
  rejected: { label: 'Abgelehnt', bg: 'rgba(255,107,107,0.15)',color: '#ff6b6b' },
};

type PageTab = 'projekte' | 'voting';

/* ── Voting-Tab für Employee ── */
function EmployeeVotingTab() {
  const [ranking, setRanking]               = useState<VotingRankingEntry[]>([]);
  const [monthByProject, setMonthByProject] = useState<Record<string, number>>({});
  const [totalByProject, setTotalByProject] = useState<Record<string, number>>({});
  const [monthTotal, setMonthTotal]         = useState(0);
  const [grandTotal, setGrandTotal]         = useState(0);
  const [months, setMonths]                 = useState<MonthEntry[]>([]);
  const [distributions, setDistributions]   = useState<DistEntry[]>([]);
  const [selectedMonth, setSelectedMonth]   = useState<string>('all');
  const [statusFilter, setStatusFilter]     = useState<string>('all');
  const [loading, setLoading]               = useState(true);
  const [distLoading, setDistLoading]       = useState(false);
  const [selectedProj, setSelectedProj]     = useState<VotingRankingEntry | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/impact-distributions?mode=ranking', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/impact-distributions?mode=months', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([r, m]: [VotingRankingResponse, MonthEntry[]]) => {
        if (r?.ranking) {
          setRanking(r.ranking);
          setMonthByProject(r.month_by_project ?? {});
          setTotalByProject(r.total_by_project ?? {});
          setMonthTotal(r.month_total_eur ?? 0);
          setGrandTotal(r.grand_total_eur ?? 0);
        }
        setMonths(Array.isArray(m) ? m : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setDistLoading(true);
    const url = selectedMonth === 'all'
      ? '/api/impact-distributions?limit=200'
      : `/api/impact-distributions?month=${selectedMonth}&limit=200`;
    fetch(url, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setDistributions(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setDistLoading(false));
  }, [selectedMonth]);

  const totalVotes = ranking.reduce((s, r) => s + (r.vote_count ?? 0), 0);
  const top3 = ranking.filter(r => r.rank != null && r.rank <= 3).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const completed = ranking.filter(r => r.is_completed);

  const allProjects = ranking.filter(r => {
    if (statusFilter === 'completed') return r.is_completed;
    if (statusFilter === 'active') return !r.is_completed;
    if (statusFilter === 'approved') return r.status === 'approved' || r.status === 'published';
    if (statusFilter === 'pending') return r.status === 'pending' || r.status === 'submitted';
    return true;
  });

  const filteredDist = distributions;
  const filteredTotal = filteredDist.reduce((s, d) => s + Number(d.amount_eur ?? 0), 0);
  const perProjectDist: Record<string, number> = {};
  for (const d of filteredDist) {
    perProjectDist[d.project_id] = (perProjectDist[d.project_id] ?? 0) + Number(d.amount_eur ?? 0);
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      ⏳ Lade Abstimmungs-Daten…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Aktive Projekte', value: ranking.filter(r => !r.is_completed).length, icon: '💚' },
          { label: 'Stimmen gesamt', value: totalVotes, icon: '🗳️' },
          { label: 'Diesen Monat', value: fmtEur(monthTotal), icon: '💸' },
          { label: 'Abgeschlossen', value: completed.length, icon: '✅' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 18 }}>{k.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 2px' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Top 3 Ranking */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>🏆 Live-Ranking — Top 3</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>50 / 30 / 20 % der Ausschüttung</span>
          {monthTotal > 0 && (
            <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginLeft: 'auto' }}>Diesen Monat: {fmtEur(monthTotal)}</span>
          )}
        </div>
        {top3.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Stimmen abgegeben</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {top3.map(r => {
              const pct = r.funding_goal ? Math.min(100, (r.current_amount / r.funding_goal) * 100) : 0;
              return (
                <div key={r.project_id} onClick={() => setSelectedProj(r)} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-primary)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span style={{ fontSize: 22 }}>{rankMedal(r.rank)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{r.project_name}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginTop: 3, flexWrap: 'wrap' }}>
                      <span>🗳️ {r.vote_count} Stimmen</span>
                      <span style={{ color: r.rank === 1 ? '#f59e0b' : r.rank === 2 ? '#6b7280' : '#cd7c32', fontWeight: 600 }}>
                        {r.share_pct != null ? `${r.share_pct}% Anteil` : '—'}
                      </span>
                      <span>💰 {fmtEur(r.current_amount)} / {fmtEur(r.funding_goal)}</span>
                    </div>
                    {/* Fortschrittsbalken */}
                    <div style={{ background: 'var(--border)', borderRadius: 6, height: 6, overflow: 'hidden', marginTop: 6, maxWidth: 400 }}>
                      <div style={{ width: `${pct}%`, background: r.is_completed ? '#22c55e' : 'var(--accent)', height: '100%', borderRadius: 6, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                  <span style={{ flexShrink: 0 }}>
                    {r.is_completed
                      ? <span style={{ background: '#22c55e22', color: '#22c55e', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>✅ Fertig</span>
                      : <span style={{ background: '#3b82f622', color: '#3b82f6', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>🔄 Aktiv</span>
                    }
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alle Projekte mit Filter */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>📋 Alle Projekte ({allProjects.length})</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'Alle' },
              { key: 'active', label: 'Aktiv' },
              { key: 'completed', label: 'Abgeschlossen' },
              { key: 'approved', label: 'Bewilligt' },
              { key: 'pending', label: 'Ausstehend' },
            ].map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${statusFilter === f.key ? 'var(--accent)' : 'var(--border)'}`,
                background: statusFilter === f.key ? 'rgba(78,205,196,0.15)' : 'var(--bg-primary)',
                color: statusFilter === f.key ? 'var(--accent)' : 'var(--text-muted)',
              }}>{f.label}</button>
            ))}
          </div>
        </div>
        {allProjects.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Keine Projekte in diesem Filter</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Rang', 'Projekt', 'Stimmen', 'Status', 'Diesen Monat', 'Gesamt', 'Fortschritt'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allProjects.map(r => {
                const pct = r.funding_goal ? Math.min(100, (r.current_amount / r.funding_goal) * 100) : 0;
                const mAmt = monthByProject[r.project_id] ?? 0;
                const tAmt = totalByProject[r.project_id] ?? 0;
                return (
                  <tr key={r.project_id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => setSelectedProj(r)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', fontSize: 16 }}>{rankMedal(r.rank)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.project_name}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{r.vote_count}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.is_completed
                        ? <span style={{ background: '#22c55e22', color: '#22c55e', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>✅ Fertig</span>
                        : r.status === 'pending' || r.status === 'submitted'
                        ? <span style={{ background: '#f59e0b22', color: '#f59e0b', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>⏳ Ausstehend</span>
                        : <span style={{ background: '#3b82f622', color: '#3b82f6', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>🔄 Aktiv</span>
                      }
                    </td>
                    <td style={{ padding: '10px 14px', color: mAmt > 0 ? 'var(--green)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: mAmt > 0 ? 600 : 400 }}>{fmtEur(mAmt)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{fmtEur(tAmt)}</td>
                    <td style={{ padding: '10px 14px', minWidth: 90 }}>
                      <div style={{ background: 'var(--border)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, background: r.is_completed ? '#22c55e' : 'var(--accent)', height: '100%', borderRadius: 6 }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{pct.toFixed(0)}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Monatliche Ausschüttungen */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>💸 Ausschüttungen</span>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)',
            background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', marginLeft: 'auto',
          }}>
            <option value="all">Alle Monate</option>
            {months.map(m => <option key={m.month} value={m.month}>{fmtMonthLabel(m.month)} — {fmtEur(m.total)}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filteredDist.length} Einträge · {fmtEur(filteredTotal)}</span>
        </div>

        {/* Per-project summary cards */}
        {Object.keys(perProjectDist).length > 0 && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(perProjectDist).sort((a, b) => b[1] - a[1]).map(([pid, amt]) => {
              const proj = ranking.find(r => r.project_id === pid);
              return (
                <div key={pid} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', minWidth: 140 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                    {proj?.project_name ?? pid.slice(0, 8) + '…'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', marginTop: 2 }}>{fmtEur(amt)}</div>
                </div>
              );
            })}
          </div>
        )}

        {distLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>⏳ Lade…</div>
        ) : filteredDist.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Ausschüttungen</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Datum', 'Monat', 'Projekt', 'Rang', 'Anteil', 'Betrag'].map(h => (
                    <th key={h} style={{ padding: '8px 13px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDist.map(d => {
                  const proj = ranking.find(r => r.project_id === d.project_id);
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{d.distributed_at ? new Date(d.distributed_at).toLocaleDateString('de-DE') : '—'}</td>
                      <td style={{ padding: '8px 13px' }}>
                        <span style={{ background: '#8b5cf622', color: '#8b5cf6', padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{fmtMonthLabel(d.pool_month)}</span>
                      </td>
                      <td style={{ padding: '8px 13px', color: 'var(--text-primary)', fontWeight: 500 }}>{proj?.project_name ?? d.project_id.slice(0, 8) + '…'}</td>
                      <td style={{ padding: '8px 13px', fontSize: 15 }}>{rankMedal(d.rank_at_time)}</td>
                      <td style={{ padding: '8px 13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{d.share_pct}%</td>
                      <td style={{ padding: '8px 13px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: d.rank_at_time === 1 ? '#f59e0b' : d.rank_at_time === 2 ? '#6b7280' : '#cd7c32' }}>{fmtEur(Number(d.amount_eur))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completed Projects */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>🏁 Abgeschlossene Projekte ({completed.length})</span>
        </div>
        {completed.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Noch keine abgeschlossenen Projekte</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Projekt', 'Stimmen', 'Förderziel', 'Gesamt erhalten', 'Abgeschlossen am'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completed.map(r => {
                const tAmt = totalByProject[r.project_id] ?? r.current_amount;
                return (
                  <tr key={r.project_id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => setSelectedProj(r)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.project_name}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.vote_count}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtEur(r.funding_goal)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{fmtEur(tAmt)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{r.reviewed_at ? fmtTime(r.reviewed_at) : (r.created_at ? fmtTime(r.created_at) : '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail-Modal */}
      {selectedProj && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}
          onClick={() => setSelectedProj(null)}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 0, maxWidth: 560, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{rankMedal(selectedProj.rank)}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedProj.project_name}</span>
              </div>
              <button onClick={() => setSelectedProj(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              {selectedProj.short_desc && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>{selectedProj.short_desc}</p>}
              {[
                ['Rang', selectedProj.rank != null ? `Platz ${selectedProj.rank}` : 'Nicht gerankt'],
                ['Stimmen', `${selectedProj.vote_count}`],
                ['Anteil', selectedProj.share_pct != null ? `${selectedProj.share_pct}%` : '—'],
                ['Förderziel', fmtEur(selectedProj.funding_goal)],
                ['Bisher erhalten', fmtEur(selectedProj.current_amount)],
                ['Diesen Monat', fmtEur(monthByProject[selectedProj.project_id] ?? 0)],
                ['Gesamt ausgeschüttet', fmtEur(totalByProject[selectedProj.project_id] ?? 0)],
                ['Status', selectedProj.is_completed ? '✅ Abgeschlossen' : '🔄 Aktiv'],
                ['Antragsteller', selectedProj.applicant_name ?? '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <button onClick={() => setSelectedProj(null)} style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Haupt-Komponente ── */
export default function ImpactPage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [pageTab, setPageTab] = useState<PageTab>('projekte');
  const [projects, setProjects] = useState<ImpactProject[]>([]);
  const [pool,     setPool]     = useState<PoolData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<string>('all');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<ImpactProject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
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
        // FIX: totalEur war faelschlich = bruttoPool (6%-Wert), dann im UI durch 0.15 geteilt -> doppelt falsch.
        // Jetzt direkt der echte Gesamtumsatz aus der Overview-API (ov.totalRevenue).
        totalEur:       ov.totalRevenue ?? 0,
        distributedEur: ov.distributed ?? 0,
        awardedEur:     projData.awardedEur ?? 0,
        openEur:        ov.openImpact ?? 0,
        totalVotes:     projData.totalVotes ?? 0,
        bruttoPool:     ov.bruttoPool ?? 0,
        nettoImpact:    ov.nettoImpact ?? 0,
        firmenanteil:   ov.firmenanteil ?? 0,
        innovationFund: ov.innovationFund ?? 0,
        flexPool:       ov.flexPool ?? 0,
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
      <PageHeader title="Impact Pool" subtitle="20\u00a0% jedes Umsatzes gehen an HUI (Balanced Growth v1) \u2014 10\u00a0% Unternehmen, 6\u00a0% Impact-Pool, 4\u00a0% Innovationsfonds"
        actionsRole={userRole as 'superadmin' | 'employee'} userRole={userRole}
        actions={<button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>\u21ba Refresh</button>}
      />

      {/* Top-Level Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-primary)', borderRadius: 10, padding: 3, border: '1px solid var(--border)', width: 'fit-content' }}>
        <button onClick={() => setPageTab('projekte')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          background: pageTab === 'projekte' ? 'var(--accent)' : 'transparent',
          color: pageTab === 'projekte' ? '#fff' : 'var(--text-muted)',
        }}>📋 Projekte</button>
        <button onClick={() => setPageTab('voting')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          background: pageTab === 'voting' ? 'var(--accent)' : 'transparent',
          color: pageTab === 'voting' ? '#fff' : 'var(--text-muted)',
        }}>🗳️ Abstimmung & Ranking</button>
      </div>

      {pageTab === 'voting' ? (
        <EmployeeVotingTab />
      ) : (
        <>
          {/* Finanz-KPIs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {pool ? (
              <>
                {kpiCard('Gesamtumsatz',              fmtEur(pool.totalEur),        '\uD83D\uDCB0', 'var(--text-primary)')}
                {kpiCard('Unternehmensanteil (10%)',   fmtEur(pool.firmenanteil),    '\uD83C\uDFE2', '#ffd43b')}
                {kpiCard('Impact-Pool (6%)',           fmtEur(pool.bruttoPool),      '\uD83C\uDF31', '#74C0FC')}
                {kpiCard('Innovationsfonds (4%)',      fmtEur(pool.innovationFund), '\uD83D\uDCA1', '#B197FC')}
              </>
            ) : (
              <>
                {kpiCard('Gesamtumsatz',              '\u20ac0,00', '\uD83D\uDCB0', 'var(--text-primary)')}
                {kpiCard('Unternehmensanteil (10%)',  '\u20ac0,00', '\uD83C\uDFE2', '#ffd43b')}
                {kpiCard('Impact-Pool (6%)',          '\u20ac0,00', '\uD83C\uDF31', '#74C0FC')}
                {kpiCard('Innovationsfonds (4%)',     '\u20ac0,00', '\uD83D\uDCA1', '#B197FC')}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {pool ? (
              <>
                {kpiCard('Projekte-Anteil (4,2% \u2014 70% v. Pool)', fmtEur(pool.nettoImpact), '\uD83C\uDF1F', '#51CF66')}
                {kpiCard('Flex-R\u00fccklage (1,8% \u2014 30% v. Pool)', fmtEur(pool.flexPool), '\uD83D\uDD04', '#06B6D4')}
              </>
            ) : (
              <>
                {kpiCard('Projekte-Anteil (4,2%)', '\u20ac0,00', '\uD83C\uDF1F', '#51CF66')}
                {kpiCard('Flex-R\u00fccklage (1,8%)', '\u20ac0,00', '\uD83D\uDD04', '#06B6D4')}
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
        </>
      )}
    </EmployeeLayout>
  );
}
