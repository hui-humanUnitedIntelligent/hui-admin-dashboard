// frontend/src/app/ambassadors/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────
interface AmbassadorRecord {
  id: string; display_name: string; username: string; avatar_url: string | null;
  role: string; is_wirker: boolean; trust_score: number; created_at: string;
  referral_code: string; level: AmbLevel; status: string;
  ambassador_since: string; referral_count: number; revenue_generated: number;
  rewards: { type: string; name: string; granted_at: string }[];
}
interface AmbStats {
  active_ambassadors: number; total_referrals: number; referred_users: number;
  total_revenue: number; gross_impact: number; net_impact: number;
  level_distribution: Record<string,number>;
}
interface AmbDetail {
  profile: Record<string,unknown>; ambassador: Record<string,unknown>;
  referrals: { id: string; display_name: string; username: string; avatar_url: string | null; joined_at: string }[];
}
type AmbLevel = 'bronze' | 'silver' | 'gold' | 'platinum';
type Tab = 'all' | 'bronze' | 'silver' | 'gold' | 'platinum';

// ── Design constants ──────────────────────────────────────────
const LEVEL_CONFIG: Record<AmbLevel, { color: string; bg: string; icon: string; label: string; min_ref: number; min_rev: number }> = {
  bronze:   { color: '#CD7F32', bg: 'rgba(205,127,50,0.12)',  icon: '🥉', label: 'Bronze',   min_ref: 0,  min_rev: 0    },
  silver:   { color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)', icon: '🥈', label: 'Silber',   min_ref: 3,  min_rev: 100  },
  gold:     { color: '#FFD700', bg: 'rgba(255,215,0,0.12)',   icon: '🥇', label: 'Gold',     min_ref: 10, min_rev: 400  },
  platinum: { color: '#B197FC', bg: 'rgba(177,151,252,0.12)', icon: '💎', label: 'Platin',   min_ref: 20, min_rev: 1000 },
};

function fmtEur(n: number) { return n >= 1000 ? `€${(n/1000).toFixed(1)}K` : `€${n.toFixed(2)}`; }
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `vor ${m} Min.`;
  if (m < 1440) return `vor ${Math.floor(m/60)} Std.`;
  return `vor ${Math.floor(m/1440)} Tagen`;
}
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }); }

// ── LevelBadge ────────────────────────────────────────────────
function LevelBadge({ level }: { level: AmbLevel }) {
  const c = LEVEL_CONFIG[level] || LEVEL_CONFIG.bronze;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.color}55`, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {c.icon} {c.label}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#0F1117', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────
function AmbassadorDrawer({ ambId, onClose, onRefresh }: { ambId: string; onClose: () => void; onRefresh: () => void }) {
  const [detail, setDetail] = useState<AmbDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ambassador?action=detail&user_id=${ambId}`)
      .then(r => r.json()).then(d => { setDetail(d); setLoading(false); }).catch(() => setLoading(false));
  }, [ambId]);

  const doAction = async (action: string, data: Record<string,unknown> = {}) => {
    setActing(true);
    try {
      const res = await fetch('/api/ambassador', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: ambId, data }),
      });
      if (res.ok) {
        showToast('Erfolgreich gespeichert', 'success');
        onRefresh();
        // Reload detail
        const r = await fetch(`/api/ambassador?action=detail&user_id=${ambId}`).then(x => x.json());
        setDetail(r);
      } else showToast('Fehler', 'error');
    } finally { setActing(false); }
  };

  const amb = detail?.ambassador as Record<string,unknown>;
  const level = (amb?.level || 'bronze') as AmbLevel;
  const lc = LEVEL_CONFIG[level];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 480, background: 'var(--bg-primary)', borderLeft: '1px solid var(--border)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Ambassador-Detail</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Lade…</div>
        ) : !detail ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nicht gefunden</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {/* Profile Header */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: `1px solid ${lc.color}44`, borderLeft: `4px solid ${lc.color}` }}>
              <Avatar src={detail.profile.avatar_url as string} name={(detail.profile.display_name as string) || ''} size={48} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{detail.profile.display_name as string}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>@{detail.profile.username as string}</div>
                <LevelBadge level={level} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: lc.color }}>{detail.referrals.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Referrals</div>
              </div>
            </div>

            {/* Referral Code */}
            <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>🔑 Referral-Code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <code style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: lc.color, background: lc.bg, padding: '6px 14px', borderRadius: 8, border: `1px solid ${lc.color}44`, letterSpacing: 2 }}>
                  {amb?.referral_code as string}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(amb?.referral_code as string); showToast('Code kopiert', 'success'); }}
                  style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-body)' }}
                >📋</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                Referral-Link: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>hui.app/join?ref={amb?.referral_code as string}</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Referrals', value: detail.referrals.length, icon: '👥', color: 'var(--accent)' },
                { label: 'Umsatz', value: fmtEur(amb?.revenue_generated as number || 0), icon: '💰', color: 'var(--green)' },
                { label: 'Impact', value: fmtEur((amb?.revenue_generated as number || 0) * 0.15 * 0.85), icon: '🌱', color: 'var(--purple)' },
              ].map(s => (
                <div key={s.label} style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Level Progress */}
            <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>📊 Level-Verlauf</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                {(['bronze','silver','gold','platinum'] as AmbLevel[]).map(lvl => {
                  const lcc = LEVEL_CONFIG[lvl];
                  const isActive = lvl === level;
                  const isPast = ['bronze','silver','gold','platinum'].indexOf(lvl) < ['bronze','silver','gold','platinum'].indexOf(level);
                  return (
                    <div key={lvl} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: isActive ? lcc.bg : isPast ? 'rgba(255,255,255,0.04)' : 'transparent', border: `1px solid ${isActive ? lcc.color : 'var(--border)'}`, opacity: isActive || isPast ? 1 : 0.4, transition: 'all 0.2s' }}>
                      <div style={{ fontSize: 14 }}>{lcc.icon}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: isActive ? lcc.color : 'var(--text-muted)', marginTop: 3 }}>{lcc.label}</div>
                      {isActive && <div style={{ fontSize: 8, color: lcc.color, marginTop: 2 }}>✓ Aktuell</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Referral List */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                👥 Geworbene Nutzer ({detail.referrals.length})
              </div>
              {detail.referrals.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Noch keine Referrals</div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {detail.referrals.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                      <Avatar src={r.avatar_url} name={r.display_name || r.username} size={26} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.display_name || r.username}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Beigetreten {fmtDate(r.joined_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rewards */}
            {Array.isArray(amb?.rewards) && (amb.rewards as unknown[]).length > 0 && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>🏆 Belohnungen</div>
                {(amb.rewards as { type: string; name: string; granted_at: string }[]).map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 16 }}>🎖️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Vergeben {fmtDate(r.granted_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>⚙️ Admin-Aktionen</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {level !== 'platinum' && (
                  <button
                    disabled={acting}
                    onClick={async () => {
                      const levels: AmbLevel[] = ['bronze','silver','gold','platinum'];
                      const next = levels[levels.indexOf(level) + 1];
                      if (next) await doAction('upgrade_level', { level: next });
                    }}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--green)', background: 'rgba(81,207,102,0.1)', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                  >⬆️ Level anheben</button>
                )}
                <button
                  disabled={acting}
                  onClick={() => { if (confirm('Ambassador-Status wirklich entziehen?')) doAction('revoke', { reason: 'Admin-Entscheidung' }); }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--red)', background: 'rgba(255,99,99,0.08)', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                >❌ Status entziehen</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AmbassadorsPage() {
  const [ambassadors, setAmbassadors] = useState<AmbassadorRecord[]>([]);
  const [stats, setStats]             = useState<AmbStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<Tab>('all');
  const [search, setSearch]           = useState('');
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [creating, setCreating]       = useState(false);
  const [userId4Create, setUserId4Create] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [list, s] = await Promise.all([
      fetch('/api/ambassador?action=list').then(r => r.json()).catch(() => []),
      fetch('/api/ambassador?action=stats').then(r => r.json()).catch(() => null),
    ]);
    setAmbassadors(Array.isArray(list) ? list : []);
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = ambassadors.filter(a => {
    if (activeTab !== 'all' && a.level !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (a.display_name || '').toLowerCase().includes(q) || (a.username || '').toLowerCase().includes(q) || (a.referral_code || '').toLowerCase().includes(q);
    }
    return true;
  });

  const createAmbassador = async () => {
    if (!userId4Create.trim()) { showToast('User-ID erforderlich', 'error'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/ambassador', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', user_id: userId4Create.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(`✅ Ambassador erstellt — Code: ${d.referral_code}`, 'success');
        setShowCreate(false); setUserId4Create(''); load();
      } else showToast(d.error || 'Fehler', 'error');
    } finally { setCreating(false); }
  };

  const kpiTiles = [
    { label: 'Aktive Ambassadors', value: stats?.active_ambassadors ?? '…', icon: '🤝', color: 'var(--accent)' },
    { label: 'Referrals gesamt',   value: stats?.total_referrals ?? '…',    icon: '👥', color: 'var(--green)' },
    { label: 'Umsatz durch Amb.',  value: stats ? fmtEur(stats.total_revenue) : '…', icon: '💰', color: 'var(--gold)' },
    { label: 'Impact durch Amb.',  value: stats ? fmtEur(stats.net_impact) : '…',    icon: '🌱', color: 'var(--purple)' },
  ];

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'all',      label: `Alle (${ambassadors.length})`, icon: '🤝' },
    { key: 'platinum', label: `Platin (${ambassadors.filter(a=>a.level==='platinum').length})`, icon: '💎' },
    { key: 'gold',     label: `Gold (${ambassadors.filter(a=>a.level==='gold').length})`,       icon: '🥇' },
    { key: 'silver',   label: `Silber (${ambassadors.filter(a=>a.level==='silver').length})`,   icon: '🥈' },
    { key: 'bronze',   label: `Bronze (${ambassadors.filter(a=>a.level==='bronze').length})`,   icon: '🥉' },
  ];

  const input: React.CSSProperties = { width: '100%', padding: '8px 11px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };

  return (
    <DashboardLayout
      title="Ambassador-Programm"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--accent)', fontWeight: 600 }}>
            🤝 {stats?.active_ambassadors ?? '…'} aktiv
          </span>
          <button onClick={() => setShowCreate(p => !p)} style={{ padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: 8, fontSize: 11, color: '#0F1117', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-body)' }}>+ Ambassador</button>
          <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* Info Banner */}
      <div style={{ padding: '10px 16px', background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.2)', borderRadius: 10, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--accent)' }}>🤝 Ambassador-Programm</strong> — Nutzer werden Ambassadors, werben neue Mitglieder mit persönlichem Referral-Code und steigen durch Bronze → Silber → Gold → Platin auf.
      </div>

      {/* KPI Tiles */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {kpiTiles.map(k => (
          <div key={k.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, fontFamily: 'var(--font-mono)' }}>{loading ? '…' : k.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4 }}>{k.icon} {k.label}</div>
          </div>
        ))}
      </div>

      {/* Level Distribution */}
      {stats && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📊 Level-Verteilung</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            {(['bronze','silver','gold','platinum'] as AmbLevel[]).map(lvl => {
              const c  = LEVEL_CONFIG[lvl];
              const n  = stats.level_distribution?.[lvl] || 0;
              const total = stats.active_ambassadors || 1;
              const pct = Math.round((n / total) * 100);
              return (
                <div key={lvl} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.color, marginBottom: 6 }}>{c.icon} {n}</div>
                  <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: c.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>{c.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🤝 Neuen Ambassador ernennen</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>User-ID (aus User-Management)</label>
            <input value={userId4Create} onChange={e => setUserId4Create(e.target.value)} placeholder="z.B. 3a291a5c-9c4c-..." style={input} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            Der Nutzer erhält automatisch einen persönlichen Referral-Code und startet auf Bronze-Level.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowCreate(false); setUserId4Create(''); }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>Abbrechen</button>
            <button onClick={createAmbassador} disabled={creating} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1117', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)' }}>{creating ? 'Erstelle…' : 'Ambassador ernennen'}</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Ambassador suchen…" style={{ ...input, width: '100%', maxWidth: 340 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid', borderColor: activeTab === t.key ? 'var(--accent)' : 'var(--border)', background: activeTab === t.key ? 'var(--accent-dim)' : 'transparent', color: activeTab === t.key ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Lade Ambassadors…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
          <div style={{ fontSize: 13 }}>{search ? 'Kein Treffer' : 'Noch keine Ambassadors'}</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 80px', gap: 0, padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
            {['Ambassador','Referral-Code','Level','Referrals','Umsatz',''].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          {filtered.map(a => {
            const lc = LEVEL_CONFIG[a.level] || LEVEL_CONFIG.bronze;
            return (
              <div
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 80px', gap: 0, padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s', borderLeft: `3px solid ${lc.color}` }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar src={a.avatar_url} name={a.display_name || a.username} size={30} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a.display_name || a.username}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>seit {fmtDate(a.ambassador_since)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: lc.color, background: lc.bg, padding: '2px 8px', borderRadius: 6 }}>{a.referral_code}</code>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}><LevelBadge level={a.level} /></div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.referral_count}</div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{fmtEur(a.revenue_generated)}</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); setSelectedId(a.id); }} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-body)' }}>Detail</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer */}
      {selectedId && (
        <AmbassadorDrawer
          ambId={selectedId}
          onClose={() => setSelectedId(null)}
          onRefresh={load}
        />
      )}
    </DashboardLayout>
  );
}
