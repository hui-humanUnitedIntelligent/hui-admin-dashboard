// frontend/src/components/views/ImpactApplicationsView.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN-ONLY: Verwaltung der Herzensprojekte aus dem Impact Pool
// Datenquelle: impact_applications (Supabase)
// NUR für Superadmin sichtbar — Employees haben keinen Zugriff
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';
import { sbQuery, SUPABASE_URL, SUPABASE_SERVICE, SUPABASE_ANON } from '@/lib/api';

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
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  admin_comment: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejected_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

type TabKey = 'all' | 'pending' | 'approved' | 'rejected';

// ── Supabase direkt ansprechen ────────────────────────────────────────────────
async function fetchApplications(): Promise<ImpactApplication[]> {
  return sbQuery<ImpactApplication>('impact_applications', {}, {
    select: '*',
    order: 'created_at.desc',
    limit: 500,
  });
}

async function updateStatus(
  id: string,
  status: 'approved' | 'rejected',
  rejection_reason?: string,
  admin_comment?: string,
): Promise<void> {
  const adminKey = SUPABASE_SERVICE;
  const body: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
  };
  if (status === 'rejected') {
    body.rejection_reason = rejection_reason || '';
    body.rejected_at      = new Date().toISOString();
  }
  if (admin_comment) body.admin_comment = admin_comment;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/impact_applications?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey:        adminKey,
        Authorization: `Bearer ${adminKey}`,
        'Content-Type': 'application/json',
        Prefer:        'return=minimal',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(await res.text());
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
    const adminKey = SUPABASE_SERVICE || SUPABASE_ANON;
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
        rejection_reason: rejectionReason || null,
      },
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        apikey:         adminKey,
        Authorization:  `Bearer ${adminKey}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify(payload),
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

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function statusColor(status: string) {
  if (status === 'approved') return '#22c55e';
  if (status === 'rejected') return '#ef4444';
  return '#f97316'; // pending
}
function statusLabel(status: string) {
  if (status === 'approved') return '✅ Bewilligt';
  if (status === 'rejected') return '❌ Abgelehnt';
  return '⏳ In Prüfung';
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
}: {
  app: ImpactApplication;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason]         = useState('');
  const [saving, setSaving]         = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const images: string[] = [];
  if (app.cover_url) images.push(app.cover_url);
  if (Array.isArray(app.media_urls)) images.push(...app.media_urls.filter(Boolean));

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

            {/* Bildergalerie */}
            {images.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Bilder</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {images.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Bild ${i + 1}`}
                      onClick={() => setLightboxImg(url)}
                      style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', border: '1px solid var(--border)' }}
                    />
                  ))}
                </div>
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
            {app.status === 'pending' && !rejectMode && (
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

            {/* Ablehnungs-Eingabe */}
            {rejectMode && (
              <div style={{ marginTop: 20, padding: 16, background: '#ef444411', borderRadius: 12, border: '1px solid #ef444433' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 10 }}>Ablehnungsgrund (Pflichtfeld)</div>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Bitte den Grund für die Ablehnung eingeben — wird dem Nutzer angezeigt…"
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

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 18px', minWidth: 120,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>{label}</div>
    </div>
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

  const counts = {
    all:      apps.length,
    pending:  apps.filter(a => a.status === 'pending').length,
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
        `Dein Projekt „${app.project_name}" wurde angenommen. Ein Admin wird dich persönlich kontaktieren (E-Mail, Telefon oder persönlich).`,
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
        `Dein Projekt „${app.project_name}" wurde abgelehnt. Grund: ${reason}`,
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

  const TABS: { key: TabKey; label: string; color?: string }[] = [
    { key: 'all',      label: `Alle (${counts.all})` },
    { key: 'pending',  label: `⏳ Prüfung (${counts.pending})`,  color: '#f97316' },
    { key: 'approved', label: `✅ Bewilligt (${counts.approved})`, color: '#22c55e' },
    { key: 'rejected', label: `❌ Abgelehnt (${counts.rejected})`, color: '#ef4444' },
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <KPI label="Gesamt" value={counts.all} />
          <KPI label="In Prüfung" value={counts.pending} color="#f97316" />
          <KPI label="Bewilligt"  value={counts.approved} color="#22c55e" />
          <KPI label="Abgelehnt" value={counts.rejected} color="#ef4444" />
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
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Lade Projekte…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {tab === 'pending' ? '🎉 Keine offenen Projekte — alles geprüft!' : 'Keine Projekte gefunden.'}
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
        />
      )}
    </DashboardLayout>
  );
}
