// frontend/src/components/views/ImpactApplicationsView.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN-ONLY: Verwaltung der Herzensprojekte aus dem Impact Pool
// Datenquelle: impact_applications (Supabase)
// NUR für Superadmin sichtbar — Employees haben keinen Zugriff
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/ui/KPICard';
import { showToast } from '@/components/ui/Toast';
// api imports bereinigt (Prompt 8) — nutzt jetzt Server-API-Routen
import { getSessionToken } from '@/lib/session';


// ── Types ─────────────────────────────────────────────────────────────────────
interface ImpactApplication {
  id: string;
  user_id: string;
  project_name: string;
  short_desc: string | null;
  problem: string | null;
  vision: string | null;
  funding_goal: number | null;
  funding_use: string | null;
  contact_email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  location: string | null;
  cover_url: string | null;
  media_urls: string[] | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  youtube: string | null;
  other_links: string | null;
  why_support: string | null;
  status: string; // Echte DB-Werte: 'approved' | 'rejected'
  rejection_reason: string | null;
  admin_comment: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejected_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

type TabKey = 'all' | 'approved' | 'rejected' | 'voting';


async function fetchApplications(): Promise<ImpactApplication[]> {
  const res = await fetch('/api/impact-applications?limit=500', {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const j = await res.json();
  // ok() wrapper: { success, data: { applications, total, stats } }
  // Fallbacks für direkte Array-Responses
  const payload = j?.data ?? j;
  const arr = Array.isArray(payload?.applications) ? payload.applications
            : Array.isArray(payload)               ? payload
            : [];
  return arr as ImpactApplication[];
}

async function updateStatus(
  id: string,
  status: 'approved' | 'rejected',
  rejection_reason?: string,
  admin_comment?: string,
): Promise<void> {
  const body: Record<string, unknown> = { status };
  if (status === 'rejected') body.rejection_reason = rejection_reason ?? '';
  if (admin_comment)         body.admin_comment    = admin_comment;

  const res = await fetch(`/api/impact-applications/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Status-Update fehlgeschlagen: ${res.status}`);
}

async function sendResonanzNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  projectId?: string,
  projectName?: string,
  rejectionReason?: string,
): Promise<void> {
  try {
    // Verwendet die bestehende notifications-Tabelle (Resonanzzentrum der be-hui App)
    const payload: Record<string, unknown> = {
      user_id:     userId,
      type,
      title,
      body,
      entity_id:   projectId   || null,
      entity_type: 'impact_project',
      action_url:  '/impact',   // Link zum Impact-Pool in der App
      is_read:     false,
      read:        false,
      created_at:  new Date().toISOString(),
      metadata: {
        project_id:       projectId    || null,
        project_name:     projectName  || null,
        entry_title:      projectName  || null,
        rejection_reason: rejectionReason || null,
        reason:           rejectionReason || null,
      },
    };

    const res = await fetch(`/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification: payload }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Resonanzzentrum notification failed:', errText);
    } else {
      console.log('[HUI_IMPACT] Resonanzzentrum notification sent ✓', { type, userId: userId.slice(0,8)+'…' });
    }
  } catch (e) {
    console.warn('Resonanzzentrum notification exception:', e);
  }
}


// ── Impact Voting Types (Phase 3) ─────────────────────────────────────────────
interface ImpactRanking {
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
  cover_url: string | null;
  contact_email: string | null;
  created_at: string | null;
  reviewed_at: string | null;
}

interface RankingResponse {
  ok: boolean;
  ranking: ImpactRanking[];
  month_total_eur: number;
  month_by_project: Record<string, number>;
  grand_total_eur: number;
  total_by_project: Record<string, number>;
  pool_month: string;
}

interface ImpactDistribution {
  id: string;
  order_id: string;
  project_id: string;
  rank_at_time: number;
  share_pct: number;
  amount_eur: number;
  pool_month: string;
  distributed_at: string;
}

async function fetchImpactRanking(month?: string): Promise<RankingResponse> {
  const url = month
    ? `/api/impact-distributions?mode=ranking&month=${month}`
    : '/api/impact-distributions?mode=ranking';
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Ranking fetch failed: ${res.status}`);
  const j = await res.json();
  // Fallback: alte API ohne ranking-Wrapper
  if (j?.ranking) return j as RankingResponse;
  return {
    ok: true,
    ranking: Array.isArray(j) ? j : (j?.data ?? []),
    month_total_eur: 0,
    month_by_project: {},
    grand_total_eur: 0,
    total_by_project: {},
    pool_month: new Date().toISOString().slice(0, 7),
  };
}

async function fetchImpactDistributions(): Promise<ImpactDistribution[]> {
  const res = await fetch('/api/impact-distributions?limit=100', { credentials: 'include' });
  if (!res.ok) throw new Error(`Distributions fetch failed: ${res.status}`);
  const j = await res.json();
  return (j?.data ?? j ?? []) as ImpactDistribution[];
}

// ── VotingDetailPanel (Detail-Panel bei Klick auf ein Projekt) ──────────────────
function VotingDetailPanel({
  project,
  ranking,
  monthByProject,
  totalByProject,
  onClose,
}: {
  project: ImpactRanking;
  ranking: ImpactRanking[];
  monthByProject: Record<string, number>;
  totalByProject: Record<string, number>;
  onClose: () => void;
}) {
  const totalVotes = ranking.reduce((s, r) => s + r.vote_count, 0);
  const votePct = totalVotes > 0 ? ((project.vote_count / totalVotes) * 100).toFixed(1) : '0.0';
  const fundingPct = project.funding_goal > 0 ? Math.min(100, (project.current_amount / project.funding_goal) * 100) : 0;
  const monthAmt = monthByProject[project.project_id] ?? 0;
  const totalAmt = totalByProject[project.project_id] ?? 0;

  const fmtEur = (n: number | null | undefined) =>
    n != null ? `€ ${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  const fmtDate = (s: string | null | undefined) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const row = (label: string, value: React.ReactNode, highlight?: boolean) => (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: highlight ? 'var(--green)' : 'var(--text-primary)', fontWeight: highlight ? 700 : 400 }}>{value}</span>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 9001, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 640, boxShadow: '0 24px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {project.rank === 1 && <span style={{ fontSize: 24 }}>🥇</span>}
                {project.rank === 2 && <span style={{ fontSize: 24 }}>🥈</span>}
                {project.rank === 3 && <span style={{ fontSize: 24 }}>🥉</span>}
                {project.rank == null || project.rank > 3 ? <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>#{project.rank ?? '—'}</span> : null}
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{project.project_name}</span>
              </div>
              {project.short_desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{project.short_desc}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, padding: 4, flexShrink: 0 }}>✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px' }}>
            {row('Rang', project.rank != null ? `Platz ${project.rank}` : 'Nicht gerankt')}
            {row('Status', project.is_completed
              ? <span style={{ background: '#22c55e22', color: '#22c55e', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>✅ Abgeschlossen</span>
              : <span style={{ background: '#3b82f622', color: '#3b82f6', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>🔄 Aktiv</span>
            )}
            {row('Stimmen', `${project.vote_count} (${votePct}% der Gesamtstimmen)`, true)}
            {row('Anteil an Ausschüttung', project.share_pct != null ? `${project.share_pct}%` : '—')}
            {row('Förderziel', fmtEur(project.funding_goal))}
            {row('Bisher erhalten', fmtEur(project.current_amount), true)}
            {row('Fortschritt', (
              <div>
                <div style={{ background: 'var(--border)', borderRadius: 6, height: 10, overflow: 'hidden', minWidth: 200 }}>
                  <div style={{ width: `${fundingPct}%`, background: project.is_completed ? '#22c55e' : 'var(--accent)', height: '100%', borderRadius: 6, transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{fundingPct.toFixed(1)}% des Förderziels</div>
              </div>
            ))}
            {row('Diesen Monat ausgeschüttet', fmtEur(monthAmt), monthAmt > 0)}
            {row('Gesamt ausgeschüttet', fmtEur(totalAmt), totalAmt > 0)}
            {row('Antragsteller', project.applicant_name ?? '—')}
            {row('Kontakt', project.contact_email ?? '—')}
            {row('Eingereicht am', fmtDate(project.created_at))}
            {project.is_completed && row('Abgeschlossen am', fmtDate(project.reviewed_at))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── VotingTab Komponente ───────────────────────────────────────────────────────
function VotingTab() {
  const [ranking, setRanking]                     = useState<ImpactRanking[]>([]);
  const [monthByProject, setMonthByProject]       = useState<Record<string, number>>({});
  const [totalByProject, setTotalByProject]       = useState<Record<string, number>>({});
  const [monthTotal, setMonthTotal]               = useState(0);
  const [grandTotal, setGrandTotal]               = useState(0);
  const [distributions, setDistributions]         = useState<ImpactDistribution[]>([]);
  const [months, setMonths]                       = useState<{month:string;total:number;entries:number}[]>([]);
  const [stats, setStats]                         = useState<{total_eur:number;count:number}|null>(null);
  const [selectedMonth, setSelectedMonth]         = useState<string>('all');
  const [statusFilter, setStatusFilter]           = useState<string>('all');
  const [loading, setLoading]                     = useState(true);
  const [distLoading, setDistLoading]             = useState(false);
  const [selectedProject, setSelectedProject]     = useState<ImpactRanking | null>(null);
  // Vormonat-Archiv
  const [archiveData, setArchiveData]             = useState<{pool_month:string;project_id:string;project_name:string;vote_count:number;total_weight:number}[]>([]);
  const [archiveMonths, setArchiveMonths]         = useState<string[]>([]);
  const [archiveMonth, setArchiveMonth]           = useState<string>('');
  const [archiveLoading, setArchiveLoading]       = useState(false);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchImpactRanking(),
      fetch('/api/impact-distributions?mode=months', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/impact-distributions?mode=stats', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([r, m, s]) => {
        setRanking(r.ranking ?? []);
        setMonthByProject(r.month_by_project ?? {});
        setTotalByProject(r.total_by_project ?? {});
        setMonthTotal(r.month_total_eur ?? 0);
        setGrandTotal(r.grand_total_eur ?? 0);
        setMonths(Array.isArray(m) ? m : []);
        setStats(s?.total_eur != null ? s : null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Distributions laden wenn Monat gewählt
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

  const fmtEur2 = (n: number | null | undefined) =>
    n != null ? `€ ${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  const fmtDate = (s: string) =>
    new Date(s).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    const names = ['','Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    return `${names[parseInt(mo)]} ${y}`;
  };

  const rankMedal = (r: number | null) => {
    if (r === 1) return '🥇';
    if (r === 2) return '🥈';
    if (r === 3) return '🥉';
    return `#${r ?? '—'}`;
  };

  const totalVotes = ranking.reduce((s, r) => s + (r.vote_count ?? 0), 0);
  const totalAmt   = stats?.total_eur ?? grandTotal;
  const top3       = ranking.filter(r => r.rank != null && r.rank <= 3).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const completed  = ranking.filter(r => r.is_completed);

  // All projects (approved + pending) with status filter
  const allProjects = ranking.filter(r => {
    if (statusFilter === 'completed') return r.is_completed;
    if (statusFilter === 'active') return !r.is_completed;
    if (statusFilter === 'approved') return r.status === 'approved' || r.status === 'published';
    if (statusFilter === 'pending') return r.status === 'pending' || r.status === 'submitted';
    return true;
  });

  const filteredDist   = distributions;

  // Aggregat für gewählten Monat
  const filteredTotal  = filteredDist.reduce((s, d) => s + Number(d.amount_eur ?? 0), 0);

  // Archiv laden
  useEffect(() => {
    setArchiveLoading(true);
    const url = archiveMonth ? `/api/impact-votes-archive?month=${archiveMonth}` : '/api/impact-votes-archive';
    fetch(url, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setArchiveData(Array.isArray(d.data) ? d.data : []);
        if (archiveMonths.length === 0 && Array.isArray(d.months)) setArchiveMonths(d.months);
        if (!archiveMonth && Array.isArray(d.months) && d.months.length > 0) setArchiveMonth(d.months[0]);
      })
      .catch(console.error)
      .finally(() => setArchiveLoading(false));
  }, [archiveMonth]); // eslint-disable-line

  // Per-project aggregation for selected month
  const perProjectDist: Record<string, number> = {};
  for (const d of filteredDist) {
    perProjectDist[d.project_id] = (perProjectDist[d.project_id] ?? 0) + Number(d.amount_eur ?? 0);
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      ⏳ Lade Voting-Daten…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Bewilligte Projekte', value: ranking.filter(r => !r.is_completed).length, icon: '💚' },
          { label: 'Stimmen gesamt',      value: totalVotes,          icon: '🗳️' },
          { label: 'Gesamt ausgeschüttet', value: fmtEur2(totalAmt),  icon: '💸' },
          { label: 'Abgeschlossen',       value: completed.length,    icon: '✅' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 20 }}>{k.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Monatliche Zusammenfassung */}
      {months.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>📅 Monatliche Ausschüttungen</span>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '14px 18px', flexWrap: 'wrap' }}>
            {months.map(m => (
              <div key={m.month} style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 16px',
                minWidth: 140, textAlign: 'center',
                cursor: 'pointer',
                borderColor: selectedMonth === m.month ? 'var(--accent)' : 'var(--border)',
              }} onClick={() => setSelectedMonth(selectedMonth === m.month ? 'all' : m.month)}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtMonth(m.month)}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{fmtEur2(m.total)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{m.entries} Ausschüttungen</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aktuelles Ranking — Top 3 */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>🏆 Aktuelles Ranking — Top 3</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>erhalten 50 / 30 / 20 % der Projektförderung</span>
          {monthTotal > 0 && (
            <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginLeft: 'auto' }}>
              Diesen Monat: {fmtEur2(monthTotal)}
            </span>
          )}
        </div>
        {top3.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Noch keine Stimmen abgegeben
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Rang', 'Projekt', 'Stimmen', 'Anteil', 'Ziel', 'Bisher erhalten', 'Fortschritt', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top3.map(r => {
                const pct = r.funding_goal ? Math.min(100, (r.current_amount / r.funding_goal) * 100) : 0;
                return (
                  <tr key={r.project_id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => setSelectedProject(r)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px', fontSize: 20 }}>{rankMedal(r.rank)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{r.project_name}</div>
                      {r.contact_email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.contact_email}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{r.vote_count}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: r.rank === 1 ? '#f59e0b' : r.rank === 2 ? '#6b7280' : '#cd7c32', fontFamily: 'var(--font-mono)' }}>
                      {r.share_pct != null ? `${r.share_pct}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtEur2(r.funding_goal)}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{fmtEur2(r.current_amount)}</td>
                    <td style={{ padding: '12px 14px', minWidth: 120 }}>
                      <div style={{ background: 'var(--border)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, background: r.is_completed ? '#22c55e' : 'var(--accent)', height: '100%', borderRadius: 6, transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{pct.toFixed(1)}%</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {r.is_completed
                        ? <span style={{ background: '#22c55e22', color: '#22c55e', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>✅ Abgeschlossen</span>
                        : <span style={{ background: '#3b82f622', color: '#3b82f6', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>🔄 Aktiv</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Alle Projekte-Liste (approved + pending) mit Filter */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>📋 Alle Projekte ({allProjects.length})</span>
          {/* Status-Filter */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {[
              { key: 'all',       label: 'Alle' },
              { key: 'active',    label: 'Aktiv' },
              { key: 'completed', label: 'Abgeschlossen' },
              { key: 'approved',  label: 'Bewilligt' },
              { key: 'pending',   label: 'Ausstehend' },
            ].map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${statusFilter === f.key ? 'var(--accent)' : 'var(--border)'}`,
                background: statusFilter === f.key ? 'rgba(78,205,196,0.15)' : 'var(--bg-primary)',
                color: statusFilter === f.key ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {allProjects.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Keine Projekte in diesem Filter
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Rang', 'Projekt', 'Stimmen', 'Status', 'Diesen Monat', 'Gesamt erhalten', 'Fortschritt'].map(h => (
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
                    onClick={() => setSelectedProject(r)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', fontSize: 16 }}>{rankMedal(r.rank)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.project_name}
                      {r.applicant_name && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{r.applicant_name}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{r.vote_count}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.is_completed
                        ? <span style={{ background: '#22c55e22', color: '#22c55e', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>✅ Abgeschlossen</span>
                        : r.status === 'pending' || r.status === 'submitted'
                        ? <span style={{ background: '#f59e0b22', color: '#f59e0b', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>⏳ Ausstehend</span>
                        : <span style={{ background: '#3b82f622', color: '#3b82f6', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>🔄 Aktiv</span>
                      }
                    </td>
                    <td style={{ padding: '10px 14px', color: mAmt > 0 ? 'var(--green)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: mAmt > 0 ? 600 : 400 }}>{fmtEur2(mAmt)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{fmtEur2(tAmt)}</td>
                    <td style={{ padding: '10px 14px', minWidth: 100 }}>
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

      {/* Monatliche Ausschüttungen pro Projekt */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>💸 Monatliche Ausschüttungen pro Projekt</span>
          {/* Monat-Filter */}
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)',
            background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', marginLeft: 'auto',
          }}>
            <option value="all">Alle Monate</option>
            {months.map(m => (
              <option key={m.month} value={m.month}>{fmtMonth(m.month)} — {fmtEur2(m.total)}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filteredDist.length} Einträge · Total: {fmtEur2(filteredTotal)}
          </span>
        </div>

        {/* Per-project summary */}
        {Object.keys(perProjectDist).length > 0 && (
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(perProjectDist)
              .sort((a, b) => b[1] - a[1])
              .map(([pid, amt]) => {
                const proj = ranking.find(r => r.project_id === pid);
                return (
                  <div key={pid} style={{
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '8px 14px', minWidth: 160,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                      {proj?.project_name ?? pid.slice(0, 8) + '…'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', marginTop: 2 }}>{fmtEur2(amt)}</div>
                  </div>
                );
              })}
          </div>
        )}

        {distLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>⏳ Lade…</div>
        ) : filteredDist.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Noch keine Ausschüttungen — wird nach der ersten echten Transaktion befüllt
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Datum', 'Monat', 'Projekt', 'Rang', 'Anteil', 'Betrag', 'Order-ID'].map(h => (
                    <th key={h} style={{ padding: '9px 13px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDist.map(d => {
                  const proj = ranking.find(r => r.project_id === d.project_id);
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmtDate(d.distributed_at)}</td>
                      <td style={{ padding: '9px 13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        <span style={{ background: '#8b5cf622', color: '#8b5cf6', padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                          {fmtMonth(d.pool_month)}
                        </span>
                      </td>
                      <td style={{ padding: '9px 13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {proj?.project_name ?? d.project_id.slice(0, 8) + '…'}
                      </td>
                      <td style={{ padding: '9px 13px', fontSize: 16 }}>{rankMedal(d.rank_at_time)}</td>
                      <td style={{ padding: '9px 13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{d.share_pct}%</td>
                      <td style={{ padding: '9px 13px', fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: d.rank_at_time === 1 ? '#f59e0b' : d.rank_at_time === 2 ? '#6b7280' : '#cd7c32' }}>
                        {fmtEur2(Number(d.amount_eur))}
                      </td>
                      <td style={{ padding: '9px 13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                        {d.order_id.slice(0, 12)}…
                      </td>
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
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>🏁 Abgeschlossene Projekte ({completed.length})</span>
        </div>
        {completed.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Noch keine abgeschlossenen Projekte
          </div>
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
                    onClick={() => setSelectedProject(r)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.project_name}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.vote_count}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtEur2(r.funding_goal)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{fmtEur2(tAmt)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {r.reviewed_at ? fmtDate(r.reviewed_at).split(',')[0] : (r.created_at ? fmtDate(r.created_at).split(',')[0] : '—')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Vormonat-Archiv */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>📦 Vormonat-Archiv</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stimmen nach Monats-Reset archiviert</span>
          {archiveMonths.length > 0 && (
            <select
              value={archiveMonth}
              onChange={e => setArchiveMonth(e.target.value)}
              style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              {archiveMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
          )}
        </div>
        {archiveLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>⏳ Lade Archiv…</div>
        ) : archiveData.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Noch keine archivierten Stimmen vorhanden.<br />
            <span style={{ fontSize: 11 }}>Nach dem monatlichen Reset werden die Vormonat-Stimmen hier gespeichert.</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Rang', 'Projekt', 'Stimmen', 'Gewicht', 'Monat'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {archiveData
                .filter(r => !archiveMonth || r.pool_month === archiveMonth)
                .map((r, i) => (
                <tr key={`${r.pool_month}-${r.project_id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 16 }}>{rankMedal(i + 1)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.project_name}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{r.vote_count}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.total_weight}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{fmtMonth(r.pool_month)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail-Panel */}
      {selectedProject && (
        <VotingDetailPanel
          project={selectedProject}
          ranking={ranking}
          monthByProject={monthByProject}
          totalByProject={totalByProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}
// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function statusColor(status: string) {
  if (status === 'approved') return '#22c55e';
  if (status === 'rejected') return '#ef4444';
  return '#6b7280';
}
function statusLabel(status: string) {
  if (status === 'approved') return '✅ Bewilligt';
  if (status === 'rejected') return '❌ Abgelehnt';
  return `${status}`;
}
function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtEur(n: number | null) {
  if (!n) return '—';
  return `€ ${n.toLocaleString('de-DE')}`;
}

// ── Collapsible Text ──────────────────────────────────────────────────────────
function ColText({ text, max = 200 }: { text: string | null; max?: number }) {
  const [open, setOpen] = useState(false);
  if (!text) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  if (text.length <= max) return <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{text}</span>;
  return (
    <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
      {open ? text : text.slice(0, max) + '…'}
      <button onClick={() => setOpen(o => !o)} style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
        {open ? 'Weniger' : 'Mehr'}
      </button>
    </span>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({
  app,
  onClose,
  onApprove,
  onReject,
  onDelete,
}: {
  app: ImpactApplication;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [rejectMode,  setRejectMode]  = useState(false);
  const [deleteMode,  setDeleteMode]  = useState(false);
  const [reason, setReason]           = useState('');
  const [saving, setSaving]           = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [milestones, setMilestones]   = useState<any[]>([]);
  const [updates, setUpdates]         = useState<any[]>([]);

  // ── Meilensteine & Updates laden ──────────────────────────────
  useEffect(() => {
    if (!app?.id) return;
    setMilestones([]);
    setUpdates([]);
    Promise.all([
      fetch(`/api/impact-milestones?project_id=${app.id}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/impact-updates?project_id=${app.id}`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([ms, upds]) => {
      setMilestones(ms.data || []);
      setUpdates(upds.data || []);
    }).catch(() => {});
  }, [app?.id]);

  // ── Medien-Klassifikation ──────────────────────────────────────
  const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(url);
  const isVideo = (url: string) => /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url);
  const isPdf   = (url: string) => /\.pdf(\?|$)/i.test(url);
  const getFileLabel = (url: string) => {
    const parts = url.split('/');
    const name  = decodeURIComponent(parts[parts.length - 1].split('?')[0]);
    return name.length > 40 ? name.slice(0, 37) + '…' : name;
  };

  // Titelbild separat, dann restliche Medien typisiert
  const coverUrl: string | null = app.cover_url || null;
  const allMedia: string[] = Array.isArray(app.media_urls)
    ? app.media_urls.filter(Boolean)
    : [];
  const mediaImages  = allMedia.filter(isImage);
  const mediaVideos  = allMedia.filter(isVideo);
  const mediaPdfs    = allMedia.filter(isPdf);
  const mediaOthers  = allMedia.filter(u => !isImage(u) && !isVideo(u) && !isPdf(u));

  const handleApprove = async () => {
    setSaving(true);
    await onApprove(app.id);
    setSaving(false);
    onClose();
  };

  const handleReject = async () => {
    if (!reason.trim()) { showToast('Bitte Ablehnungsgrund eingeben', 'error'); return; }
    setSaving(true);
    await onReject(app.id, reason.trim());
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setSaving(true);
    await onDelete(app.id);
    setSaving(false);
    onClose();
  };

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9001,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}>
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          width: '100%', maxWidth: 760,
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>💚 {app.project_name}</span>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                  background: statusColor(app.status) + '22',
                  color: statusColor(app.status),
                  border: `1px solid ${statusColor(app.status)}44`,
                }}>{statusLabel(app.status)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Eingereicht: {fmt(app.submitted_at || app.created_at)} · ID: {app.id.slice(0, 8)}…
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, padding: 4, flexShrink: 0 }}>✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px' }}>

            {/* ── Titelbild ── */}
            {coverUrl && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  📸 Titelbild
                </div>
                <img
                  src={coverUrl}
                  alt="Titelbild"
                  onClick={() => setLightboxImg(coverUrl)}
                  style={{
                    width: '100%', maxHeight: 220, objectFit: 'cover',
                    borderRadius: 12, cursor: 'zoom-in',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            )}

            {/* ── Zusatzmaterial ── */}
            {(mediaImages.length > 0 || mediaVideos.length > 0 || mediaPdfs.length > 0 || mediaOthers.length > 0) && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  📎 Zusatzmaterial ({allMedia.length} Datei{allMedia.length !== 1 ? 'en' : ''})
                </div>

                {/* Bilder */}
                {mediaImages.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>🖼️ Bilder ({mediaImages.length})</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {mediaImages.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Bild ${i + 1}`}
                          onClick={() => setLightboxImg(url)}
                          style={{
                            width: 110, height: 80, objectFit: 'cover',
                            borderRadius: 8, cursor: 'zoom-in',
                            border: '1px solid var(--border)',
                            transition: 'transform 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos */}
                {mediaVideos.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>🎬 Videos ({mediaVideos.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {mediaVideos.map((url, i) => (
                        <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <video
                            controls
                            preload="metadata"
                            style={{ width: '100%', maxHeight: 240, display: 'block', background: '#000' }}
                          >
                            <source src={url} />
                            Dein Browser unterstützt keine Video-Wiedergabe.
                          </video>
                          <div style={{
                            padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)',
                            background: 'var(--bg-primary)', display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getFileLabel(url)}
                            </span>
                            <a href={url} target="_blank" rel="noreferrer"
                              style={{ marginLeft: 8, color: 'var(--accent)', fontSize: 11, whiteSpace: 'nowrap', fontWeight: 600 }}>
                              ↗ Öffnen
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PDFs */}
                {mediaPdfs.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>📄 PDF-Dokumente ({mediaPdfs.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {mediaPdfs.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            textDecoration: 'none',
                            color: 'var(--text-primary)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)11')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                        >
                          <span style={{ fontSize: 22 }}>📄</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getFileLabel(url)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PDF · Klicken zum Öffnen</div>
                          </div>
                          <span style={{ fontSize: 16, color: 'var(--accent)', flexShrink: 0 }}>↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sonstige Dateien */}
                {mediaOthers.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>📎 Weitere Dateien ({mediaOthers.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {mediaOthers.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            textDecoration: 'none',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <span style={{ fontSize: 22 }}>📎</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getFileLabel(url)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Datei · Klicken zum Herunterladen</div>
                          </div>
                          <span style={{ fontSize: 16, color: 'var(--accent)', flexShrink: 0 }}>↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Felder */}
            <div>
              {row('Kurzbeschreibung', <ColText text={app.short_desc} />)}
              {row('Problem', <ColText text={app.problem} />)}
              {row('Vision / Lösung', <ColText text={app.vision} />)}
              {row('Warum Förderung', <ColText text={app.why_support} />)}
              {row('Wunschbetrag', fmtEur(app.funding_goal))}
              {row('Mittelverwendung', <ColText text={app.funding_use} />)}
              {row('Standort', app.location || '—')}
              {row('Kontakt E-Mail', app.contact_email ? (
                <a href={`mailto:${app.contact_email}`} style={{ color: 'var(--accent)' }}>{app.contact_email}</a>
              ) : '—')}
              {row('Kontakt Name', app.contact_name || '—')}
              {row('Kontakt Telefon', app.contact_phone || '—')}
              {app.website && row('Website', <a href={app.website} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{app.website}</a>)}
              {app.instagram && row('Instagram', app.instagram)}
              {app.linkedin && row('LinkedIn', app.linkedin)}
              {app.youtube && row('YouTube', app.youtube)}
              {app.other_links && row('Weitere Links', app.other_links)}
              {row('User-ID', (
                <a href={`/users?highlight=${app.user_id}`} style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12 }}>
                  {app.user_id}
                </a>
              ))}
              {app.rejection_reason && row('Ablehnungsgrund', (
                <span style={{ color: '#ef4444' }}>{app.rejection_reason}</span>
              ))}
              {app.admin_comment && row('Admin-Kommentar', app.admin_comment)}
            </div>

            {/* Aktionen */}
            {(app.status !== 'approved' && app.status !== 'rejected') && !rejectMode && !deleteMode && (
              <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  style={{
                    padding: '10px 24px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#fff', fontWeight: 700, fontSize: 14,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? '…' : '✅ Projekt freigeben'}
                </button>
                <button
                  onClick={() => setRejectMode(true)}
                  style={{
                    padding: '10px 24px', borderRadius: 10, border: '1px solid #ef4444', cursor: 'pointer',
                    background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 14,
                  }}
                >
                  ❌ Ablehnen
                </button>
              </div>
            )}

            {/* Löschen-Button für bewilligte + abgelehnte Projekte */}
            {(app.status === 'approved' || app.status === 'rejected') && !deleteMode && (
              <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setDeleteMode(true)}
                  style={{
                    padding: '10px 24px', borderRadius: 10,
                    border: '1px solid #ef4444', cursor: 'pointer',
                    background: 'transparent', color: '#ef4444',
                    fontWeight: 600, fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  🗑️ Bewilligung widerrufen & löschen
                </button>
              </div>
            )}

            {/* Löschen-Bestätigung */}
            {deleteMode && (
              <div style={{
                marginTop: 20, padding: 16,
                background: '#ef444411',
                borderRadius: 12,
                border: '1px solid #ef444433',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                  ⚠️ Projekt wirklich löschen?
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                  Das Projekt <strong style={{ color: 'var(--text-primary)' }}>„{app.project_name}"</strong> wird
                  dauerhaft aus der Datenbank entfernt. Der Nutzer wird per Benachrichtigung informiert.
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    style={{
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: '#ef4444', color: '#fff',
                      fontWeight: 700, fontSize: 14,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? '…' : '🗑️ Ja, endgültig löschen'}
                  </button>
                  <button
                    onClick={() => setDeleteMode(false)}
                    disabled={saving}
                    style={{
                      padding: '10px 20px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-muted)', fontWeight: 600, fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Ablehnungs-Eingabe */}
            {rejectMode && (
              <div style={{ marginTop: 20, padding: 16, background: '#ef444411', borderRadius: 12, border: '1px solid #ef444433' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 10 }}>Ablehnungsgrund (Pflichtfeld)</div>

                {/* Vordefinierte Ablehnungsgründe */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Schnellauswahl:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { label: '📝 Beschreibung zu vage', text: 'Die Projektbeschreibung ist zu allgemein gehalten. Bitte beschreibe konkret: Wer profitiert? Was wird umgesetzt? Welche Wirkung entsteht?' },
                      { label: '🎯 Kein HUI-Bezug', text: 'Das Projekt passt leider nicht zu den HUI-Kategorien (Bildung, Umwelt, Gemeinschaft, Gesundheit, Kultur). Bitte prüfe, ob du dein Projekt stärker auf einen dieser Bereiche ausrichten kannst.' },
                      { label: '💰 Förderbetrag unrealistisch', text: 'Der angegebene Förderbetrag steht nicht im Verhältnis zum beschriebenen Projektumfang. Bitte überarbeite die Mittelverwendung nachvollziehbar.' },
                      { label: '👥 Zielgruppe unklar', text: 'Die Zielgruppe des Projekts ist nicht klar definiert. Bitte präzisiere, wen du mit deinem Projekt erreichen und unterstützen möchtest.' },
                      { label: '🔄 Zu ähnlich zu bestehendem Projekt', text: 'Ein sehr ähnliches Projekt ist bereits auf der HUI-Plattform aktiv. Um Doppelförderung zu vermeiden, empfehlen wir eine Kooperation oder eine stärkere Differenzierung.' },
                      { label: '📊 Wirkung nicht messbar', text: 'Die beschriebene Wirkung des Projekts ist schwer messbar oder nachvollziehbar. Bitte ergänze konkrete Erfolgskriterien oder Meilensteine.' },
                      { label: '⚠️ Unvollständige Angaben', text: 'Deine Einreichung enthält unvollständige Pflichtangaben. Bitte fülle alle Felder vollständig aus und reiche das Projekt erneut ein.' },
                      { label: '🚫 Persönlicher Nutzen', text: 'Das eingereichte Projekt scheint überwiegend dem persönlichen Nutzen zu dienen. HUI fördert ausschließlich Projekte mit gemeinwohlorientierter Wirkung.' },
                    ].map(({ label, text }) => (
                      <button
                        key={label}
                        onClick={() => setReason(prev => prev ? prev + ' ' + text : text)}
                        style={{
                          padding: '5px 10px', borderRadius: 99, fontSize: 11.5, cursor: 'pointer',
                          border: reason.includes(text.slice(0,20)) ? '1.5px solid #ef4444' : '1px solid var(--border)',
                          background: reason.includes(text.slice(0,20)) ? '#ef444418' : 'var(--bg-secondary)',
                          color: reason.includes(text.slice(0,20)) ? '#ef4444' : 'var(--text-secondary)',
                          fontWeight: 500, transition: 'all 0.15s',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Oder eigenen Ablehnungsgrund eingeben / obige Auswahl anpassen…"
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 9,
                    border: '1px solid var(--border)', background: 'var(--bg-primary)',
                    color: 'var(--text-primary)', fontSize: 13, resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={handleReject}
                    disabled={saving || !reason.trim()}
                    style={{
                      padding: '9px 22px', borderRadius: 9, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                      background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13,
                      opacity: saving || !reason.trim() ? 0.6 : 1,
                    }}
                  >
                    {saving ? '…' : 'Ablehnen bestätigen'}
                  </button>
                  <button
                    onClick={() => { setRejectMode(false); setReason(''); }}
                    style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* ── Meilensteine ── */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                🏁 Meilensteine{milestones.length > 0 ? ` (${milestones.length})` : ''}
              </div>
              {milestones.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Keine Meilensteine definiert.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {milestones.map((m, i) => (
                    <div key={m.id || i} style={{ padding: '12px 14px', background: '#0d948811', borderRadius: 10, border: '1px solid #0d948822' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', background: '#0d9488',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.title}</div>
                            {m.status && (
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
                                background: m.status === 'completed' ? '#22c55e15' : m.status === 'in_progress' ? '#3b82f615' : '#6b728015',
                                color: m.status === 'completed' ? '#22c55e' : m.status === 'in_progress' ? '#3b82f6' : '#6b7280',
                              }}>
                                {m.status === 'completed' ? '✅ Abgeschlossen' : m.status === 'in_progress' ? '🔄 In Arbeit' : '📅 Geplant'}
                              </span>
                            )}
                          </div>
                          {m.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{m.description}</div>}
                          {m.target_date && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>📅 Geplant: {new Date(m.target_date).toLocaleDateString('de-DE')}</div>}
                        </div>
                      </div>

                      {/* Milestone Updates */}
                      {m.impact_milestone_updates && Array.isArray(m.impact_milestone_updates) && m.impact_milestone_updates.length > 0 && (
                        <div style={{ marginTop: 10, marginLeft: 38, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                            Updates ({m.impact_milestone_updates.length}):
                          </div>
                          {m.impact_milestone_updates.map((u: any, j: number) => (
                            <div key={u.id || j} style={{ padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {u.content ? (u.content.length > 100 ? u.content.slice(0, 100) + '...' : u.content) : ''}
                                </span>
                                {u.created_at && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {new Date(u.created_at).toLocaleDateString('de-DE')}
                                  </span>
                                )}
                              </div>
                              {u.media_urls && Array.isArray(u.media_urls) && u.media_urls.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                  {u.media_urls.slice(0, 3).map((url: string, k: number) => (
                                    <img key={k} src={url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>


            {/* ── Projekt-Updates ── */}
            {updates.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  📢 Projekt-Updates ({updates.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {updates.map((u, i) => (
                    <div key={u.id || i} style={{ padding: '12px 14px', background: '#16a34a11', borderRadius: 10, border: '1px solid #16a34a22' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        {u.update_type && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', background: '#0d948815', padding: '2px 8px', borderRadius: 99 }}>{u.update_type}</span>
                        )}
                        {u.created_at && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString('de-DE')}</span>
                        )}
                      </div>
                      {u.title && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{u.title}</div>}
                      {u.content && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{u.content}</div>}
                      {u.media_urls && Array.isArray(u.media_urls) && u.media_urls.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          {u.media_urls.map((url: string, j: number) => (
                            <img key={j} src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightboxImg} alt="Vollbild" style={{ maxWidth: '92vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
        </div>
      )}
    </>
  );
}

// ── Haupt-View ────────────────────────────────────────────────────────────────
export default function ImpactApplicationsView() {
  const [apps, setApps]         = useState<ImpactApplication[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<TabKey>('all');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<ImpactApplication | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApplications();
      setApps(data);
    } catch (e) {
      showToast('Fehler beim Laden der Impact-Projekte', 'error');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Echte DB-Status: approved | rejected
  const filtered = apps.filter(a => {
    if (tab !== 'all' && a.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.project_name?.toLowerCase().includes(q) ||
        a.short_desc?.toLowerCase().includes(q) ||
        a.contact_email?.toLowerCase().includes(q) ||
        a.user_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Echte DB-Status: approved | rejected
  const counts = {
    all:      apps.length,
    approved: apps.filter(a => a.status === 'approved').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
  };

  const handleApprove = async (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;
    try {
      await updateStatus(id, 'approved');
      await sendResonanzNotification(
        app.user_id,
        'impact_project_approved',
        '💚 Dein Herzensprojekt wurde angenommen!',
        `Glückwunsch! 🎉 Dein Projekt „${app.project_name}" wurde angenommen. Ein Admin wird sich innerhalb von 14 Tagen persönlich bei dir melden (per E-Mail, Telefon oder persönlich).`,
        id,
        app.project_name,
      );
      showToast('Projekt freigegeben ✅', 'success');
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a));
    } catch (e) {
      showToast('Fehler beim Freigeben', 'error');
      console.error(e);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;
    try {
      await updateStatus(id, 'rejected', reason);
      await sendResonanzNotification(
        app.user_id,
        'impact_project_rejected',
        '📋 Dein Herzensprojekt wurde abgelehnt',
        `Dein Projekt „${app.project_name}" wurde abgelehnt. Tippe, um den Ablehnungsgrund zu sehen.`,
        id,
        app.project_name,
        reason,
      );
      showToast('Projekt abgelehnt', 'error');
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected', rejection_reason: reason } : a));
    } catch (e) {
      showToast('Fehler beim Ablehnen', 'error');
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;
    try {
      // Hard-Delete via Server-Route (service role key server-only)
      const res = await fetch(`/api/impact-applications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getSessionToken()}` },
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      // Nutzer benachrichtigen
      try {
        await sendResonanzNotification(
          app.user_id,
          'impact_project_deleted',
          '🗑️ Dein Herzensprojekt wurde entfernt',
          `Dein Projekt „${app.project_name}" wurde vom HUI-Team entfernt. Bei Fragen wende dich bitte an den Support.`,
          id,
          app.project_name,
          'Administrativ entfernt',
        );
      } catch { /* Notification-Fehler nicht kritisch */ }
      showToast('Projekt gelöscht', 'error');
      setApps(prev => prev.filter(a => a.id !== id));
      setSelected(null);
    } catch (e) {
      showToast('Fehler beim Löschen', 'error');
      console.error(e);
    }
  };

  // Echte DB-Status: approved | rejected
  const TABS: { key: TabKey; label: string; color?: string }[] = [
    { key: 'all',      label: `Alle (${counts.all})` },
    { key: 'approved', label: `✅ Bewilligt (${counts.approved})`, color: '#22c55e' },
    { key: 'rejected', label: `❌ Abgelehnt (${counts.rejected})`, color: '#ef4444' },
    { key: 'voting',   label: '🗳️ Voting & Verteilung', color: '#8b5cf6' },
  ];

  return (
    <DashboardLayout title="💚 Impact Projekte">
      <div style={{ padding: '24px 28px', maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>💚 Impact Projekte</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Herzensprojekte aus dem Impact Pool — eingereicht von der Community
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          <KPICard label="Gesamt"      value={String(counts.all)}      icon="📋" variant="teal" />
          <KPICard label="Bewilligt" value={String(counts.approved)} icon="✅" variant="green" deltaPositive />
          <KPICard label="Abgelehnt" value={String(counts.rejected)} icon="❌" variant="red" />
          <KPICard label="Abgeschlossen" value={String(apps.filter(a => (a as any).is_completed).length)} icon="🏁" variant="teal" />
        </div>

        {/* Tabs + Suche */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-primary)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
                  background: tab === t.key ? 'var(--accent)' : 'transparent',
                  color: tab === t.key ? '#fff' : t.color || 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >{t.label}</button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen (Titel, E-Mail, User-ID…)"
            style={{
              padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)',
              background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13,
              outline: 'none', minWidth: 240,
            }}
          />
          <button onClick={load} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
            🔄 Aktualisieren
          </button>
        </div>

        {/* Liste */}
        {tab === 'voting' ? (
          <VotingTab />
        ) : loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Lade Projekte…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {'Keine Projekte gefunden.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map(app => (
              <div
                key={app.id}
                onClick={() => setSelected(app)}
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 13, padding: '14px 18px', cursor: 'pointer',
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  borderLeft: `3px solid ${statusColor(app.status)}`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      💚 {app.project_name}
                    </span>
                    <span style={{
                      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: statusColor(app.status) + '22', color: statusColor(app.status),
                    }}>{statusLabel(app.status)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {app.short_desc && <span>{app.short_desc.slice(0, 80)}{app.short_desc.length > 80 ? '…' : ''}</span>}
                    {app.contact_email && <span>📧 {app.contact_email}</span>}
                    {app.funding_goal && <span>💰 {fmtEur(app.funding_goal)}</span>}
                    <span>📅 {fmt(app.submitted_at || app.created_at)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>›</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <DetailModal
          app={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={handleDelete}
        />
      )}
    </DashboardLayout>
  );
}
