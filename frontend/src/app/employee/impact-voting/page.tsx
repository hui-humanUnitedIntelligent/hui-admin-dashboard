// frontend/src/app/employee/impact-voting/page.tsx
// IMPACT-VOTING-ENGINE-001 — Impact Voting Ansicht für EDB
// Zeigt: aktuelles Monats-Ranking (Top 3), Stimmen-Verteilung als Balkendiagramm,
//        Gesamtstimmen diesen Monat, Ausschüttungs-Historie.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/hooks/useAuth';
import { getSessionToken } from '@/lib/session';

/* ── Typen ── */
interface RankingEntry {
  project_id:   string;
  project_name: string;
  votes:        number;
  rank:         number;
  share_pct?:   number;
  current_amount_eur?: number;
  funding_goal?: number;
  status?: string;
}
interface VoteDistributionEntry {
  project_id:   string;
  project_name: string;
  votes:        number;
}
interface VoteData {
  ok:            boolean;
  month:         string;
  total_votes:   number;
  unique_voters: number;
  distribution:  VoteDistributionEntry[];
}
interface DistributionMonth {
  month:   string;
  total:   number;
  entries: number;
}
interface DistributionEntry {
  project_id:   string;
  amount_eur:   number;
  pool_month:   string;
  rank_at_time: number;
  share_pct:    number;
}

/* ── Hilfs-Funktionen ── */
function fmtEur(n: number | null | undefined): string {
  const v = n ?? 0;
  return `\u20ac${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtMonth(m: string): string {
  if (!m || m === 'unknown') return '—';
  const [y, mo] = m.split('-');
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${months[parseInt(mo, 10) - 1] ?? mo} ${y}`;
}

const RANK_COLORS = ['#ffd43b', '#C0C0C0', '#CD7F32']; // Gold, Silber, Bronze
const RANK_EMOJI  = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

export default function ImpactVotingPage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [ranking, setRanking]         = useState<RankingEntry[]>([]);
  const [voteData, setVoteData]       = useState<VoteData | null>(null);
  const [distMonths, setDistMonths]   = useState<DistributionMonth[]>([]);
  const [distDetail, setDistDetail]   = useState<DistributionEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const chartRef  = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getSessionToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const [rankRes, voteRes, distMonthsRes] = await Promise.all([
        fetch('/api/impact-ranking', { credentials: 'include', headers }),
        fetch('/api/impact-votes', { credentials: 'include', headers }),
        fetch('/api/impact-distributions?mode=months', { credentials: 'include', headers }),
      ]);

      if (!rankRes.ok) throw new Error(`HTTP ${rankRes.status} (impact-ranking)`);
      if (!voteRes.ok) throw new Error(`HTTP ${voteRes.status} (impact-votes)`);
      if (!distMonthsRes.ok) throw new Error(`HTTP ${distMonthsRes.status} (impact-distributions months)`);

      // Ranking — API gibt Array oder { ok, error } zurück
      const rankJson = await rankRes.json();
      const rankArr: RankingEntry[] = Array.isArray(rankJson) ? rankJson : (rankJson?.ok ? (rankJson.data ?? []) : []);

      // Vote-Verteilung
      const voteJson: VoteData = await voteRes.json();

      // Ausschüttungs-Monate
      const distMonthsJson: DistributionMonth[] = await distMonthsRes.json();

      setRanking(rankArr);
      setVoteData(voteJson?.ok ? voteJson : null);
      setDistMonths(Array.isArray(distMonthsJson) ? distMonthsJson : []);

      // Ersten Monat automatisch auswählen für Detail-Ansicht
      if (distMonthsJson?.length > 0 && !selectedMonth) {
        setSelectedMonth(distMonthsJson[0].month);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[impact-voting]', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { load(); }, [load]);

  // Auto-Refresh alle 30s
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  // Detail-Einträge für ausgewählten Monat laden
  useEffect(() => {
    if (!selectedMonth) return;
    (async () => {
      try {
        const token = getSessionToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch(`/api/impact-distributions?month=${selectedMonth}`, { credentials: 'include', headers });
        if (!res.ok) return;
        const data = await res.json();
        setDistDetail(Array.isArray(data) ? data : []);
      } catch { /* silent */ }
    })();
  }, [selectedMonth]);

  // ── Bar Chart mit chart.js (dynamisch geladen, wie dashboard/page.tsx) ──
  useEffect(() => {
    if (!voteData?.distribution?.length || !chartRef.current) return;

    let cancelled = false;
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      if (cancelled) return;
      Chart.register(...registerables);

      if (chartInst.current) {
        (chartInst.current as { destroy: () => void }).destroy();
      }

      const dist = voteData.distribution;
      const labels = dist.map(d => d.project_name.length > 18 ? d.project_name.slice(0, 16) + '…' : d.project_name);
      const data   = dist.map(d => d.votes);
      const maxVotes = Math.max(...data, 1);
      const colors = dist.map((_, i) => i < 3 ? RANK_COLORS[i] : 'rgba(177,151,252,0.7)');

      chartInst.current = new Chart(chartRef.current!, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Stimmen',
            data,
            backgroundColor: colors,
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y' as const,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: { raw: unknown }) => `${ctx.raw} Stimmen`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(128,128,128,.06)' },
              ticks: { color: '#8892A4', font: { size: 10 }, precision: 0 },
            },
            y: {
              grid: { display: false },
              ticks: { color: 'var(--text-secondary, #8892A4)', font: { size: 11 } },
            },
          },
        },
      });
    })();

    return () => {
      cancelled = true;
      if (chartInst.current) {
        (chartInst.current as { destroy: () => void }).destroy();
        chartInst.current = null;
      }
    };
  }, [voteData]);

  const top3 = ranking.slice(0, 3);
  const totalDistEur = distMonths.reduce((s, m) => s + m.total, 0);

  const kpiCard = (label: string, value: string, icon: string, color: string) => (
    <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  );

  const sectionTitle = (text: string) => (
    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      {text}
    </div>
  );

  return (
    <EmployeeLayout title="Impact Voting">
      <PageHeader
        title="Impact Voting"
        subtitle={`Monats-Ranking & Stimmen-Verteilung${voteData ? ` · ${fmtMonth(voteData.month)}` : ''}`}
        actionsRole={userRole as 'superadmin' | 'employee'}
        userRole={userRole}
        actions={
          <button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        }
      />

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, fontSize: 12, color: '#ff6b6b' }}>
          Fehler beim Laden: {error}
        </div>
      )}

      {/* ── KPI-Kacheln ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {kpiCard('Gesamtstimmen (Monat)', String(voteData?.total_votes ?? 0), '\uD83D\uDDF3\uFE0F', '#B197FC')}
        {kpiCard('Eindeutige Abstimmende', String(voteData?.unique_voters ?? 0), '\uD83D\uDC65', '#74C0FC')}
        {kpiCard('Projekte im Voting', String(voteData?.distribution?.length ?? 0), '\uD83C\uDF31', '#51CF66')}
        {kpiCard('Ausschüttungen gesamt', fmtEur(totalDistEur), '\uD83D\uDCB0', '#ffd43b')}
      </div>

      {/* ── Top 3 Ranking ── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        {sectionTitle('\uD83C\uDFC6 Top 3 Ranking — aktueller Monat')}
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Lade Ranking…</div>
        ) : top3.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Keine Ranking-Daten verfügbar.</div>
        ) : (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {top3.map((p, i) => {
              const totalVotes = voteData?.total_votes ?? 1;
              const pct = totalVotes > 0 ? ((p.votes ?? 0) / totalVotes * 100) : 0;
              return (
                <div key={p.project_id} style={{
                  flex: 1, minWidth: 180, maxWidth: 280,
                  background: 'var(--bg-tertiary)', border: `2px solid ${RANK_COLORS[i] ?? 'var(--border)'}`,
                  borderRadius: 12, padding: 16, position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 22 }}>{RANK_EMOJI[i] ?? `\u00B7`}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Platz {i + 1}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, paddingRight: 28, wordBreak: 'break-word' }}>
                    {p.project_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: RANK_COLORS[i], fontFamily: 'var(--font-mono)' }}>{p.votes ?? 0}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stimmen ({pct.toFixed(1)} %)</span>
                  </div>
                  {/* Balken */}
                  <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: RANK_COLORS[i], borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                  {p.current_amount_eur != null && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                      Aktuell: {fmtEur(p.current_amount_eur)}
                      {p.funding_goal ? ` / ${fmtEur(p.funding_goal)}` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Stimmen-Verteilung (Balkendiagramm) ── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        {sectionTitle('\uD83D\uDCCA Stimmen-Verteilung')}
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Lade Verteilung…</div>
        ) : !voteData?.distribution?.length ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
            Keine Stimmen im {voteData ? fmtMonth(voteData.month) : 'aktuellen Monat'} abgegeben.
          </div>
        ) : (
          <div style={{ height: Math.max(200, voteData.distribution.length * 38), position: 'relative' }}>
            <canvas ref={chartRef} />
          </div>
        )}
      </div>

      {/* ── Ausschüttungs-Historie ── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        {sectionTitle('\uD83D\uDCB8 Ausschüttungs-Historie')}

        {/* Monats-Auswahl */}
        {distMonths.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {distMonths.map(m => (
              <button
                key={m.month}
                onClick={() => setSelectedMonth(m.month)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${selectedMonth === m.month ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedMonth === m.month ? 'rgba(78,205,196,0.15)' : 'var(--bg-tertiary)',
                  color: selectedMonth === m.month ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {fmtMonth(m.month)} · {fmtEur(m.total)}
              </button>
            ))}
          </div>
        )}

        {/* Detail-Tabelle für ausgewählten Monat */}
        {selectedMonth ? (
          distDetail.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
              Keine Ausschüttungen für {fmtMonth(selectedMonth)}.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Rang', 'Projekt-ID', 'Betrag', 'Anteil', 'Monat'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {distDetail.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        {d.rank_at_time != null ? (
                          <span style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: d.rank_at_time <= 3 ? `${RANK_COLORS[d.rank_at_time - 1]}22` : 'var(--bg-tertiary)',
                            color: d.rank_at_time <= 3 ? RANK_COLORS[d.rank_at_time - 1] : 'var(--text-muted)',
                          }}>
                            #{d.rank_at_time}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                        {d.project_id?.slice(0, 12)}…
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        {fmtEur(d.amount_eur)}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                        {d.share_pct != null ? `${d.share_pct.toFixed(1)} %` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                        {fmtMonth(d.pool_month)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
            Keine Ausschüttungs-Historie vorhanden.
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
