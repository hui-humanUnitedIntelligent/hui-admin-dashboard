'use client';
import { useRouter } from 'next/navigation';
// frontend/src/app/broadcast/page.tsx

import { isSuperAdmin } from '@/lib/roles';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { showToast } from '@/components/ui/Toast';
import { getSessionToken } from '@/lib/session';

interface BroadcastRecord { id: string; title: string; body: string; target_group: string; sent_count: number; created_at: string; }
interface Stats { total_users: number; wirker: number; members: number; admins: number; total_broadcasts: number; }

const TARGET_GROUPS = [
  { key: 'all',       label: '🌍 Alle User',     desc: 'Alle registrierten Nutzer' },
  { key: 'wirker',    label: '⭐ Wirker',         desc: 'Nur Wirker' },
  { key: 'members',   label: '🏅 Members',        desc: 'Nur Mitglieder' },
  { key: 'admins',    label: '🛡️ Admins',         desc: 'Admins & Superadmins' },
  { key: 'basisuser', label: '◎ Basisuser',       desc: 'Nicht-Wirker, Nicht-Mitglieder' },
];

function timeAgo(iso: string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return 'Gerade eben';
  if (d < 60) return `Vor ${d} Min.`;
  if (d < 1440) return `Vor ${Math.floor(d/60)} Std.`;
  return new Date(iso).toLocaleDateString('de-DE');
}

export default function BroadcastPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isSuperAdmin(currentUser?.role)) router.replace("/dashboard");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role]);
  if (!isSuperAdmin(currentUser?.role)) return null;

  const userRole = currentUser?.role;
  const [stats, setStats]             = useState<Stats | null>(null);
  const [history, setHistory]         = useState<BroadcastRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [deleting, setDeleting]       = useState<string | null>(null);

  // Form
  const [title, setTitle]             = useState('');
  const [body, setBody]               = useState('');
  const [targetGroup, setTargetGroup] = useState('all');
  const [preview, setPreview]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, h] = await Promise.all([
      fetch('/api/broadcast?action=stats', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/broadcast?action=list', { credentials: 'include' }).then(r => r.json()).catch(() => []),
    ]);
    setStats(s);
    setHistory(Array.isArray(h) ? h : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const targetInfo = TARGET_GROUPS.find(g => g.key === targetGroup);

  // Estimated recipients
  const estimated = (() => {
    if (!stats) return '…';
    if (targetGroup === 'all')       return stats.total_users;
    if (targetGroup === 'wirker')    return stats.wirker;
    if (targetGroup === 'members')   return stats.members;
    if (targetGroup === 'admins')    return stats.admins;
    if (targetGroup === 'basisuser') return Math.max(0, stats.total_users - stats.wirker - stats.members - stats.admins);
    return 0;
  })();

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) { showToast('Titel und Nachricht erforderlich', 'error'); return; }
    if (!confirm(`Broadcast an ${estimated} User senden?`)) return;
    setSending(true);
    try {
    const res = await fetch('/api/broadcast', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, target_group: targetGroup }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✅ Broadcast an ${data.sent_count} User gesendet`, 'success');
        setTitle(''); setBody(''); setPreview(false);
        load();
      } else {
        showToast(data.error || 'Fehler beim Senden', 'error');
      }
    } finally { setSending(false); }
  };

  const handleDelete = async (broadcastId: string, title: string) => {
    if (!confirm(`Broadcast "${title}" und alle ${history.find(b => b.id === broadcastId)?.sent_count ?? 0} Nachrichten unwiderruflich löschen?`)) return;
    setDeleting(broadcastId);
    try {
      const dToken = getSessionToken();
    const res = await fetch(`/api/broadcast?broadcast_id=${encodeURIComponent(broadcastId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`🗑️ Broadcast gelöscht (${data.deleted_count} Nachrichten entfernt)`, 'success');
        load();
      } else {
        showToast(data.error || 'Fehler beim Löschen', 'error');
      }
    } finally {
      setDeleting(null);
    }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '10px 13px',
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    borderRadius: 9, fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <DashboardLayout
      title="Broadcast — Push-Benachrichtigungen"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          
      <PageHeader
        title="Broadcast"
        subtitle="Nachrichten an alle Nutzer senden"
        actionsRole="superadmin"
        userRole={userRole}
      />

<span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
            📨 {history.length} gesendet
          </span>
          <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* ── Stats Row ── */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Alle User',        value: stats?.total_users ?? '…', color: 'var(--accent)', icon: '🌍' },
          { label: 'Wirker',           value: stats?.wirker ?? '…',       color: 'var(--purple)', icon: '⭐' },
          { label: 'Members',          value: stats?.members ?? '…',      color: 'var(--gold)',   icon: '🏅' },
          { label: 'Broadcasts total', value: stats?.total_broadcasts ?? '…', color: 'var(--blue)', icon: '📨' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{loading ? '…' : value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4 }}>{icon} {label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }} className="grid-2">
        {/* ── Compose ── */}
        <div>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✏️</span> Neue Broadcast-Nachricht
            </div>

            {/* Target group */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>Zielgruppe</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TARGET_GROUPS.map(g => (
                  <button
                    key={g.key}
                    onClick={() => setTargetGroup(g.key)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      border: '1px solid', cursor: 'pointer', fontFamily: 'var(--font-body)',
                      borderColor: targetGroup === g.key ? 'var(--accent)' : 'var(--border)',
                      background: targetGroup === g.key ? 'var(--accent-dim)' : 'var(--bg-primary)',
                      color: targetGroup === g.key ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >{g.label}</button>
                ))}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                {targetInfo?.desc} · <strong style={{ color: 'var(--accent)' }}>~{estimated} Empfänger</strong>
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 5 }}>Titel *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Neue Funktion verfügbar 🎉" style={input} maxLength={100} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>{title.length}/100</div>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 5 }}>Nachricht *</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Nachrichtentext…" rows={4} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} maxLength={500} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>{body.length}/500</div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPreview(p => !p)}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500 }}
              >
                {preview ? '✕ Vorschau aus' : '👁 Vorschau'}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !title.trim() || !body.trim()}
                style={{
                  flex: 1, padding: '9px 18px', borderRadius: 9, border: 'none',
                  background: sending || !title.trim() || !body.trim() ? 'var(--bg-tertiary)' : 'var(--accent)',
                  color: sending || !title.trim() || !body.trim() ? 'var(--text-muted)' : '#0F1117',
                  cursor: sending || !title.trim() || !body.trim() ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s',
                }}
              >
                {sending ? '⏳ Wird gesendet…' : `📨 An ${estimated} User senden`}
              </button>
            </div>
          </div>

          {/* Preview */}
          {preview && (title || body) && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>👁 Vorschau — wie der User es sieht</div>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #2BC5BB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0F1117' }}>HUI</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>HUI Admin</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Gerade eben · {targetInfo?.label}</div>
                  </div>
                </div>
                {title && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>}
                {body  && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{body}</div>}
              </div>
            </div>
          )}
        </div>

        {/* ── History ── */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            📋 Verlauf
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 500 }}>
            {loading ? (
              <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Lade…</div>
            ) : history.length === 0 ? (
              <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                Noch keine Broadcasts gesendet
              </div>
            ) : history.map(b => (
              <div key={b.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.body}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 600 }}>
                        {TARGET_GROUPS.find(g => g.key === b.target_group)?.label || b.target_group}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {b.sent_count} Empfänger · {timeAgo(b.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(b.id, b.title)}
                    disabled={deleting === b.id}
                    title="Broadcast löschen"
                    style={{
                      flexShrink: 0,
                      width: 28, height: 28,
                      background: 'transparent',
                      border: '1px solid transparent',
                      borderRadius: 7,
                      cursor: deleting === b.id ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                      opacity: deleting === b.id ? 0.5 : 1,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--red)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    }}
                  >
                    {deleting === b.id ? '…' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
