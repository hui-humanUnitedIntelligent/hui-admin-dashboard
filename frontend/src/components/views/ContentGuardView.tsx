// frontend/src/components/views/ContentGuardView.tsx
// CONTENT-GUARD-001 (2026-09-15, Michael-Spec Teil 2): SADB-Tab
// "Chat Content Guard" — Trigger-Events des Awareness-Guards
// (Off-App-Transaktions-Keywords im Chat). Zeigt Heute-/Woche-Counts,
// Top-Keywords/-Kategorien und die letzten Events (CSV-Export inkl.).
// Der Guard selbst laeuft client-seitig in der App (src/lib/contentGuard.js),
// die Logs schreibt er in content_guard_logs (Migration 142).
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPICard from '@/components/ui/KPICard';
import { showToast } from '@/components/ui/Toast';

interface GuardEvent {
  id: string;
  created_at: string;
  chat_id: string | null;
  user_id: string;
  category: string;
  keyword: string;
  user?: { display_name?: string | null; email?: string | null } | null;
}

interface GuardStats {
  todayCount: number;
  weekCount: number;
  topKeywords: { keyword: string; count: number }[];
  topCategories: { category: string; count: number }[];
  recent: GuardEvent[];
}

const CATEGORY_LABELS: Record<string, string> = {
  payment_methods: 'Zahlungswege',
  bank_data: 'Bankdaten',
  contact_exchange: 'Kontaktaustausch',
  direct_deal: 'Direkt-Deal',
  fee_complaints: 'Gebühren-Complaints',
  links_and_handles: 'Links & Handles',
};

export default function ContentGuardView() {
  const [stats, setStats] = useState<GuardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/content-guard', { credentials: 'include' });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const j = await res.json();
      if (j?.ok) {
        setStats({
          todayCount: j.todayCount ?? 0,
          weekCount: j.weekCount ?? 0,
          topKeywords: j.topKeywords ?? [],
          topCategories: j.topCategories ?? [],
          recent: j.recent ?? [],
        });
      } else {
        showToast(j?.error || 'Ladefehler', 'error');
      }
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCsv = useCallback(() => {
    if (!stats?.recent?.length) { showToast('Keine Events zum Export', 'info'); return; }
    const header = 'created_at,category,keyword,chat_id,user_display_name,user_email\n';
    const rows = stats.recent.map(e =>
      [
        e.created_at,
        e.category,
        e.keyword,
        e.chat_id ?? '',
        (e.user?.display_name ?? '').replace(/[,;\n]/g, ' '),
        (e.user?.email ?? '').replace(/[,;\n]/g, ' '),
      ].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-guard-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export erstellt', 'success');
  }, [stats]);

  return (
    <DashboardLayout title="🛡️ Chat Content Guard">
      {/* KPIs — Heute / Diese Woche / Top-Keyword */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
        <KPICard label="Heute" value={loading ? '…' : stats?.todayCount ?? 0} icon="⚡" delta="Trigger-Events" />
        <KPICard label="Diese Woche" value={loading ? '…' : stats?.weekCount ?? 0} icon="📈" delta="Trigger-Events" />
        <KPICard
          label="Top-Keyword (Woche)"
          value={loading ? '…' : (stats?.topKeywords?.[0] ? `${stats.topKeywords[0].keyword} (${stats.topKeywords[0].count})` : '—')}
          icon="🔍"
          delta={stats?.topKeywords?.length ? `${stats.topKeywords.length} Keywords in Top` : ''}
        />
      </div>

      {/* Top-Keywords + Top-Kategorien */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Top Keywords (7 Tage)
          </div>
          {stats?.topKeywords?.length ? (
            stats.topKeywords.map((k, i) => (
              <div key={k.keyword} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>#{i + 1} {k.keyword}</span>
                <strong>{k.count}</strong>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loading ? 'Lade…' : 'Noch keine Trigger-Events'}</div>
          )}
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Kategorien (7 Tage)
          </div>
          {stats?.topCategories?.length ? (
            stats.topCategories.map(cat => (
              <div key={cat.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{CATEGORY_LABELS[cat.category] ?? cat.category}</span>
                <strong>{cat.count}</strong>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loading ? 'Lade…' : '—'}</div>
          )}
        </div>
      </div>

      {/* Letzte Events + Export */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Letzte Events</div>
        <button
          onClick={exportCsv}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          ⬇️ Export Log (CSV)
        </button>
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Zeit</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Nutzer</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Kategorie</th>
              <th style={{ padding: '10px 12px', fontWeight: 700 }}>Keyword</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 16, color: 'var(--text-muted)' }}>Lade…</td></tr>
            ) : stats?.recent?.length ? (
              stats.recent.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('de-DE')}</td>
                  <td style={{ padding: '8px 12px' }}>{e.user?.display_name || e.user?.email || e.user_id?.slice(0, 8) || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{CATEGORY_LABELS[e.category] ?? e.category}</td>
                  <td style={{ padding: '8px 12px' }}><code>{e.keyword}</code></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} style={{ padding: 16, color: 'var(--text-muted)' }}>Noch keine Trigger-Events in den letzten 7 Tagen.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
