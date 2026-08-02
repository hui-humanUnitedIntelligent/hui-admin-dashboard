// frontend/src/components/views/RecommendationReportsView.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { showToast } from '@/components/ui/Toast';

interface ReportEntry {
  id: string;
  recommendation_id: string;
  reporter_id: string;
  offender_id: string;
  message: string;
  reason: string;
  status: 'new' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
  reporter_name: string;
  reporter_avatar: string | null;
  offender_name: string;
  offender_avatar: string | null;
  recommendation_text: string | null;
  recommendation_deleted: boolean;
  recommendation_created_at: string | null;
}

type TabKey = 'all' | 'new' | 'in_progress' | 'resolved';

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'Gerade eben';
  if (m < 60) return `Vor ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Vor ${h}h`;
  const d = Math.floor(h / 24);
  return `Vor ${d}d`;
}

function statusStyle(s: string) {
  if (s === 'new') return { bg: 'rgba(244,115,85,0.12)', color: '#C0451A', border: 'rgba(244,115,85,0.30)', label: 'Neu' };
  if (s === 'in_progress') return { bg: 'rgba(255,193,7,0.12)', color: '#8A6D00', border: 'rgba(255,193,7,0.30)', label: 'In Bearbeitung' };
  return { bg: 'rgba(13,196,181,0.10)', color: '#0AA090', border: 'rgba(13,196,181,0.25)', label: 'Erledigt' };
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'new', label: 'Neu' },
  { key: 'in_progress', label: 'In Bearbeitung' },
  { key: 'resolved', label: 'Erledigt' },
];

export function RecommendationReportsView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const url = activeTab === 'all'
        ? '/api/recommendation-reports'
        : `/api/recommendation-reports?status=${activeTab}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) setReports(await r.json());
    } catch (e) {
      console.error('[RecReports] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const r = await fetch(`/api/recommendation-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        showToast('Status aktualisiert', 'success');
        loadReports();
      }
    } catch (e) {
      console.error('[RecReports] update error:', e);
    } finally {
      setUpdating(null);
    }
  };

  const deleteRecommendation = async (reportId: string, recId: string) => {
    if (!confirm('Empfehlung endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    setUpdating(reportId);
    try {
      const r = await fetch(`/api/recommendation-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteRecommendation: true, recommendationId: recId }),
      });
      if (r.ok) {
        showToast('Empfehlung gelöscht', 'success');
        loadReports();
      }
    } catch (e) {
      console.error('[RecReports] delete error:', e);
    } finally {
      setUpdating(null);
    }
  };

  const filtered = activeTab === 'all' ? reports : reports.filter(r => r.status === activeTab);
  const newCount = reports.filter(r => r.status === 'new').length;

  return (
    <DashboardLayout>
      <PageHeader
        title="Meldungen"
        subtitle="Gemeldete Empfehlungen verwalten"
        badge={newCount > 0 ? newCount : undefined}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const count = tab.key === 'all' ? reports.length : reports.filter(r => r.status === tab.key).length;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-secondary)'}`,
                background: active ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: active ? '#fff' : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all .15s ease',
              }}
            >
              {tab.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
          Lädt…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 48,
          background: 'var(--bg-secondary)', borderRadius: 12,
          border: '1px solid var(--border-secondary)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Keine Meldungen
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Alle gemeldeten Empfehlungen werden hier angezeigt.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(r => {
            const ss = statusStyle(r.status);
            return (
              <div
                key={r.id}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 12,
                  border: '1px solid var(--border-secondary)',
                  padding: 16,
                }}
              >
                {/* Header: Status + Zeit */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`,
                  }}>
                    {ss.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {timeAgo(r.created_at)}
                  </span>
                </div>

                {/* Reporter + Offender */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {r.reporter_avatar && (
                      <img src={r.reporter_avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    )}
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Meldender</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.reporter_name}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {r.offender_avatar && (
                      <img src={r.offender_avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    )}
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Empfehlender</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.offender_name}</div>
                    </div>
                  </div>
                </div>

                {/* Empfehlungstext */}
                {r.recommendation_text && (
                  <div style={{
                    padding: '12px 14px', borderRadius: 8,
                    background: r.recommendation_deleted ? 'rgba(100,100,120,0.06)' : 'var(--bg-tertiary)',
                    marginBottom: 12,
                    border: '1px solid var(--border-tertiary)',
                    opacity: r.recommendation_deleted ? 0.6 : 1,
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      Empfehlungstext {r.recommendation_deleted && '(gelöscht)'}
                    </div>
                    <div style={{ fontSize: 13, fontStyle: 'italic', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                      "{r.recommendation_text}"
                    </div>
                  </div>
                )}

                {/* Grund */}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                  Grund: {r.reason}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.status === 'new' && (
                    <button
                      onClick={() => updateStatus(r.id, 'in_progress')}
                      disabled={updating === r.id}
                      style={{
                        padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'rgba(255,193,7,0.12)', color: '#8A6D00',
                        border: '1px solid rgba(255,193,7,0.30)',
                        cursor: updating === r.id ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', opacity: updating === r.id ? 0.6 : 1,
                      }}
                    >
                      In Bearbeitung
                    </button>
                  )}
                  {r.status !== 'resolved' && (
                    <button
                      onClick={() => updateStatus(r.id, 'resolved')}
                      disabled={updating === r.id}
                      style={{
                        padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'rgba(13,196,181,0.10)', color: '#0AA090',
                        border: '1px solid rgba(13,196,181,0.25)',
                        cursor: updating === r.id ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', opacity: updating === r.id ? 0.6 : 1,
                      }}
                    >
                      Als erledigt markieren
                    </button>
                  )}
                  {!r.recommendation_deleted && r.recommendation_id && (
                    <button
                      onClick={() => deleteRecommendation(r.id, r.recommendation_id)}
                      disabled={updating === r.id}
                      style={{
                        padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'rgba(229,62,62,0.08)', color: '#C53030',
                        border: '1px solid rgba(229,62,62,0.25)',
                        cursor: updating === r.id ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', opacity: updating === r.id ? 0.6 : 1,
                      }}
                    >
                      Empfehlung löschen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
