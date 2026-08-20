// frontend/src/components/views/ModerationView.tsx
// CONTENT-MODERATION-001 (2026-08-20): Admin-Dashboard für Inhaltsprüfung
// UPDATE (2026-08-21): Email, Avatar, Media-Vorschau, Block/Löschen/Verwarnen
'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

interface ModerationEntry {
  id: string;
  content_id: string | null;
  content_type: string | null;
  user_id: string | null;
  media_url: string | null;
  media_type: string | null;
  text: string | null;
  is_flagged: boolean;
  is_blurred: boolean;
  is_false_positive: boolean;
  flag_categories: string[];
  confidence_score: number;
  detection_source: string | null;
  detection_details: any;
  admin_status: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
  // Merged beitrag data
  beitrag_type: string | null;
  beitrag_caption: string | null;
  beitrag_content: string | null;
  beitrag_src: string | null;
  beitrag_moment_source: string | null;
  beitrag_created_at: string | null;
  beitrag_moderation_blurred: boolean;
  beitrag_moderation_flag: boolean;
  beitrag_moderation_categories: string[];
  // User data
  user_name: string;
  user_username: string | null;
  user_avatar: string | null;
  user_email: string | null;
  user_blocked: boolean;
  user_blocked_at: string | null;
  user_blocked_by: string | null;
  user_warning_count: number;
  user_last_warned_at: string | null;
}

type TabKey = 'all' | 'flagged' | 'blurred' | 'false_positive';

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

function isImage(src: string | null): boolean {
  if (!src) return false;
  return /\.(jpg|jpeg|png|gif|webp|avif)/i.test(src) || src.includes('supabase.co/storage');
}

export function ModerationView({ role }: { role: string }) {
  const [entries, setEntries] = useState<ModerationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [warnModal, setWarnModal] = useState<{ id: string; userName: string } | null>(null);
  const [blockModal, setBlockModal] = useState<{ id: string; userName: string; isDelete: boolean } | null>(null);
  const [reasonText, setReasonText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: tab });
      if (search) params.set('search', search);
      const res = await fetch(`/api/moderation?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      setEntries(json.data || []);
    } catch (e: any) {
      console.error('[ModerationView] load error:', e?.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: string, action: string, reason?: string) {
    setActionLoading(id + action);
    try {
      const res = await fetch('/api/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action, reason }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      load();
    } catch (e: any) {
      console.error('[ModerationView] action error:', e?.message);
    } finally {
      setActionLoading(null);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'Alle' },
    { key: 'flagged', label: 'Geflaggt' },
    { key: 'blurred', label: 'Verpixelt' },
    { key: 'false_positive', label: 'False Positive' },
  ];

  const content = (
    <div>
      <PageHeader
        title="Inhaltsprüfung"
        subtitle="Automatisch erkannte Inhalte via Google Vision SafeSearch + Keyword-Filter"
        badge={entries.length > 0 ? `${entries.length} Einträge` : undefined}
      />

      {/* Tabs + Search */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${tab === t.key ? 'var(--text-primary)' : 'var(--border)'}`,
              background: tab === t.key ? 'var(--text-primary)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suchen..."
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 12,
            width: 200,
          }}
        />
        <button
          onClick={load}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ↻ Aktualisieren
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Wird geladen...
        </div>
      )}

      {/* Empty */}
      {!loading && entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          Keine Moderations-Einträge in dieser Kategorie.
          <br />
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            Neue Inhalte werden automatisch beim Posten geprüft.
          </span>
        </div>
      )}

      {/* Entry Cards */}
      {!loading && entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map(entry => {
            const hasMedia = !!entry.beitrag_src || !!entry.media_url;
            const mediaSrc = entry.beitrag_src || entry.media_url;
            const showImage = hasMedia && isImage(mediaSrc);
            const isBlurred = entry.is_blurred || entry.beitrag_moderation_blurred;
            const isFlagged = entry.is_flagged || entry.beitrag_moderation_flag;
            const isFP = entry.is_false_positive;
            const isBlocked = entry.user_blocked;
            const isWarned = entry.user_warning_count > 0;

            return (
              <div
                key={entry.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  background: 'var(--bg-card)',
                  overflow: 'hidden',
                  opacity: isFP ? 0.6 : 1,
                }}
              >
                {/* Header row — User info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  background: isFlagged ? 'rgba(244,115,85,0.06)' : 'transparent',
                }}>
                  {entry.user_avatar ? (
                    <img src={entry.user_avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {(entry.user_name || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {entry.user_name}
                      {entry.user_username && (
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>@{entry.user_username}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {entry.user_email && <span>{entry.user_email} · </span>}
                      {timeAgo(entry.beitrag_created_at || entry.created_at)}
                    </div>
                  </div>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {isFlagged && !isFP && (
                      <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(244,115,85,0.15)', color: '#C0451A', fontSize: 10, fontWeight: 700 }}>FLAGGED</span>
                    )}
                    {isBlurred && (
                      <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(217,119,6,0.15)', color: '#92400E', fontSize: 10, fontWeight: 700 }}>BLURRED</span>
                    )}
                    {isFP && (
                      <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(100,100,120,0.15)', color: '#777', fontSize: 10, fontWeight: 700 }}>FALSE POSITIVE</span>
                    )}
                    {isWarned && (
                      <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(244,180,0,0.15)', color: '#92700E', fontSize: 10, fontWeight: 700 }}>VERWARNT ({entry.user_warning_count}x)</span>
                    )}
                    {isBlocked && (
                      <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(200,40,40,0.15)', color: '#C02828', fontSize: 10, fontWeight: 700 }}>GESPERRT</span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '12px 14px' }}>
                  {/* Text */}
                  {(entry.beitrag_caption || entry.beitrag_content || entry.text) && (
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)', marginBottom: 10, whiteSpace: 'pre-line' }}>
                      {entry.beitrag_content || entry.beitrag_caption || entry.text}
                    </div>
                  )}

                  {/* Media preview */}
                  {hasMedia && showImage && (
                    <div style={{
                      marginTop: 8,
                      borderRadius: 8,
                      overflow: 'hidden',
                      maxWidth: 300,
                      border: '1px solid var(--border)',
                    }}>
                      <img
                        src={mediaSrc || ""}
                        alt=""
                        style={{
                          width: '100%',
                          display: 'block',
                          filter: isBlurred ? 'blur(20px)' : 'none',
                        }}
                      />
                    </div>
                  )}
                  {hasMedia && !showImage && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      Video: {mediaSrc?.slice(0, 60)}...
                    </div>
                  )}

                  {/* Detection details */}
                  <div style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-secondary)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    lineHeight: 1.6,
                  }}>
                    <div><strong>Quelle:</strong> {entry.detection_source || '—'} · <strong>Typ:</strong> {entry.content_type || '—'}</div>
                    {entry.flag_categories && entry.flag_categories.length > 0 && (
                      <div><strong>Kategorien:</strong> {entry.flag_categories.join(', ')}</div>
                    )}
                    {entry.confidence_score > 0 && (
                      <div><strong>Confidence:</strong> {(entry.confidence_score * 100).toFixed(0)}%</div>
                    )}
                    {entry.admin_status && entry.admin_status !== 'pending' && entry.admin_status !== 'cleared' && (
                      <div><strong>Admin-Status:</strong> {entry.admin_status}</div>
                    )}
                    {entry.admin_notes && (
                      <div><strong>Notiz:</strong> {entry.admin_notes}</div>
                    )}
                  </div>

                  {/* Actions Row 1: Content actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {(isFlagged || isBlurred) && (
                      <button
                        onClick={() => handleAction(entry.id, 'approve')}
                        disabled={actionLoading === entry.id + 'approve'}
                        style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'rgba(13,196,181,0.15)', color: '#0AA090', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Freigeben
                      </button>
                    )}
                    {(isFlagged || isBlurred) && (
                      <button
                        onClick={() => handleAction(entry.id, 'false_positive')}
                        disabled={actionLoading === entry.id + 'false_positive'}
                        style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'rgba(100,100,120,0.12)', color: '#777', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        False Positive
                      </button>
                    )}
                    {!isBlurred && (
                      <button
                        onClick={() => handleAction(entry.id, 'blur')}
                        disabled={actionLoading === entry.id + 'blur'}
                        style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'rgba(217,119,6,0.15)', color: '#92400E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Verpixeln
                      </button>
                    )}
                    {isBlurred && (
                      <button
                        onClick={() => handleAction(entry.id, 'unblur')}
                        disabled={actionLoading === entry.id + 'unblur'}
                        style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: 'rgba(244,115,85,0.15)', color: '#C0451A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Entpixeln
                      </button>
                    )}
                  </div>

                  {/* Actions Row 2: User actions */}
                  {!isBlocked && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => { setWarnModal({ id: entry.id, userName: entry.user_name }); setReasonText(''); }}
                        disabled={actionLoading === entry.id + 'warn'}
                        style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(244,180,0,0.4)', background: 'rgba(244,180,0,0.08)', color: '#92700E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Verwarnen
                      </button>
                      <button
                        onClick={() => { setBlockModal({ id: entry.id, userName: entry.user_name, isDelete: false }); setReasonText(''); }}
                        disabled={actionLoading === entry.id + 'block'}
                        style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(244,115,85,0.4)', background: 'rgba(244,115,85,0.08)', color: '#C0451A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Blockieren
                      </button>
                      <button
                        onClick={() => { setBlockModal({ id: entry.id, userName: entry.user_name, isDelete: true }); setReasonText(''); }}
                        disabled={actionLoading === entry.id + 'delete'}
                        style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(200,40,40,0.4)', background: 'rgba(200,40,40,0.08)', color: '#C02828', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Warn Modal */}
      {warnModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setWarnModal(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%',
            boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Verwarnung an {warnModal.userName}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Der Nutzer erhält eine Benachrichtigung mit deinem Text.
            </p>
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              placeholder="Grund der Verwarnung (optional — Standardtext wird verwendet)"
              style={{
                width: '100%', minHeight: 80, padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setWarnModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => { handleAction(warnModal.id, 'warn', reasonText); setWarnModal(null); }}
                disabled={actionLoading === warnModal.id + 'warn'}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'rgba(244,180,0,0.8)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Verwarnen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block/Delete Modal */}
      {blockModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setBlockModal(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%',
            boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: blockModal.isDelete ? '#C02828' : '#C0451A' }}>
              {blockModal.isDelete ? 'Konto löschen' : 'Konto blockieren'}: {blockModal.userName}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {blockModal.isDelete
                ? 'Der Nutzer wird gesperrt und erhält eine Löschungs-Benachrichtigung per E-Mail.'
                : 'Der Nutzer wird gesperrt und erhält eine Blockierungs-Benachrichtigung per E-Mail.'}
            </p>
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              placeholder={blockModal.isDelete ? "Grund (optional)" : "Grund (optional)"}
              style={{
                width: '100%', minHeight: 80, padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setBlockModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => { handleAction(blockModal.id, blockModal.isDelete ? 'delete' : 'block', reasonText); setBlockModal(null); }}
                disabled={actionLoading === blockModal.id + (blockModal.isDelete ? 'delete' : 'block')}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                  background: blockModal.isDelete ? '#C02828' : '#C0451A',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {blockModal.isDelete ? 'Löschen' : 'Blockieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return <DashboardLayout>{content}</DashboardLayout>;
}
