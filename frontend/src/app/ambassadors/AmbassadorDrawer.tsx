'use client';
import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/Toast';
import { AMBASSADOR_LEVELS } from '@/lib/ambassador-levels';
import type { AmbLevel } from '@/lib/ambassador-levels';

type AmbActionPayload = { [key: string]: unknown };

interface AmbDetailData {
  profile:      Record<string, unknown>;
  refLinks:     Record<string, unknown>[];
  applications: Record<string, unknown>[];
  referrals:    { id: string; display_name: string; username: string | null; avatar_url: string | null; is_active: boolean; joined_at: string }[];
  stats:        { total: number; active: number; sleeping: number };
}

// Level-Config aus zentralem lib/ambassador-levels.ts
const LEVEL_CONFIG = Object.fromEntries(
  AMBASSADOR_LEVELS.map(l => [l.level, { color: l.color, bg: l.bg, icon: l.icon, label: l.label }])
) as Record<AmbLevel, { color: string; bg: string; icon: string; label: string }>;

const LOG_ICONS_MAP: { [key: string]: string } = {
  ambassador_approved: '✅', ambassador_activated_by_admin: '⚡',
  ambassador_application: '📋', ambassador_rejected: '❌',
  ambassador_revoked: '🚫', ambassador_level_changed: '⬆️',
  ambassador_link_enabled: '🔗', ambassador_link_disabled: '🔒',
};

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('de-DE');
}

function fmtTime(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

interface DrawerProps {
  ambId: string;
  onClose: () => void;
  onRefresh: () => void;
}

// ── Referral Tab mit aufklappbaren Nutzer-Details ──────────────────────────
function ReferralUserCard({ ref: r }: { ref: any }) {
  const [open, setOpen] = useState(false);
  const initials = (r.display_name || r.username || '?').slice(0, 2).toUpperCase();
  const hasDetails = r.email || r.phone || r.username;
  return (
    <div>
      <div
        onClick={() => hasDetails && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: 'var(--bg-secondary)',
          borderRadius: open ? '8px 8px 0 0' : 8,
          border: '1px solid var(--border)',
          borderBottom: open ? '1px solid var(--accent)' : '1px solid var(--border)',
          cursor: hasDetails ? 'pointer' : 'default',
          transition: 'border-radius .15s',
        }}
      >
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0F1117', flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.display_name || r.username || '—'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
            {r.username && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>@{r.username}</span>}
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Reg. {r.joined_at ? new Date(r.joined_at).toLocaleDateString('de-DE') : '—'}
            </span>
            {r.is_active
              ? <span style={{ fontSize: 10, fontWeight: 700, color: '#22C55E' }}>⚡ aktiv</span>
              : <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>😴 schlafend</span>
            }
            {/* COM-MIGRATION-015.3: 365-Tage-Provisionsfenster */}
            {r.commission_valid_until && (
              r.commission_window_active
                ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>💰 Provision bis {new Date(r.commission_valid_until).toLocaleDateString('de-DE')}</span>
                : <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>⏳ Provisionsfenster abgelaufen</span>
            )}
          </div>
        </div>
        {hasDetails && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', transition: 'transform .15s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
        )}
      </div>

      {/* Detail-Panel */}
      {open && (
        <div style={{
          padding: '10px 16px 12px', background: 'rgba(99,102,241,0.05)',
          border: '1px solid var(--border)', borderTop: 'none',
          borderRadius: '0 0 8px 8px', display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          {/* E-Mail */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>E-Mail</span>
            {r.email
              ? <a href={`mailto:${r.email}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</a>
              : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
            }
          </div>
          {/* Telefon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Telefon</span>
            {r.phone
              ? <a href={`tel:${r.phone}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>{r.phone}</a>
              : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
            }
          </div>
          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Rolle</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{r.role || 'basisuser'}</span>
          </div>
          {/* Erste Zahlung */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Erste Zahlung</span>
            <span style={{ fontSize: 12, color: r.first_transaction_at ? '#22C55E' : 'var(--text-muted)', fontWeight: 600 }}>
              {r.first_transaction_at ? new Date(r.first_transaction_at).toLocaleDateString('de-DE') : 'Noch keine'}
            </span>
          </div>
          {/* Nutzer-ID */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>Nutzer-ID</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferralTabContent({ referrals }: { referrals: any[] }) {
  return (
    <div style={{ padding: 16 }}>
      {referrals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>Noch keine Referrals</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            {referrals.length} geworbene Nutzer — klicken für Details
          </div>
          {referrals.map((ref: any) => (
            <ReferralUserCard key={ref.id} ref={ref} />
          ))}
        </div>
      )}
    </div>
  );
}


// ── Provisionen-Tab (COM-MIGRATION-015.3) ──────────────────────────────────
function CommissionTabContent({ ambId }: { ambId: string }) {
  const [data, setData] = useState<{ commissions: any[]; summary: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/ambassador?type=commissions&ambassador_id=' + encodeURIComponent(ambId), { credentials: 'include' })
      .then(r => r.json())
      .then(json => { if (!cancelled) setData(json?.ok ? json : null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ambId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Lade Provisionen…</div>;
  if (!data || data.commissions.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Noch keine Provisionen</div>;
  }

  const { commissions, summary } = data;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Gesamtprovision', value: '€' + summary.totalLifetimeEur.toFixed(2) },
          { label: 'Transaktionen', value: String(summary.transactionCount) },
          { label: 'Noch aktiv', value: `${summary.activeCount}/${summary.transactionCount}` },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Provisionen pro Transaktion</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {commissions.map((cm: any) => (
          <div key={cm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                €{cm.amountEur.toFixed(2)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({cm.ratePercent.toFixed(0)}% · {cm.tier})</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {cm.referredUser?.display_name || cm.referredUser?.username || '—'} · Kauf €{cm.basePurchaseEur.toFixed(2)} · {new Date(cm.createdAt).toLocaleDateString('de-DE')}
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cm.isStillActive ? 'rgba(34,197,94,0.12)' : 'var(--bg-tertiary)', color: cm.isStillActive ? '#22C55E' : 'var(--text-muted)' }}>
              {cm.isStillActive ? 'aktiv' : 'abgelaufen'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AmbassadorDrawer({ ambId, onClose, onRefresh }: DrawerProps) {
  const [detail, setDetail] = useState<AmbDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'referrals' | 'commissions' | 'works' | 'projects' | 'logs'>('overview');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const url = '/api/ambassador?action=detail&user_id=' + encodeURIComponent(ambId);
      const res = await fetch(url, { credentials: 'include', });
      const json = await res.json().catch(() => null);
      setDetail(json?.data ?? json ?? null);
    } catch { setDetail(null); }
    setLoading(false);
  }, [ambId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const act = async (action: string, payload: AmbActionPayload = {}) => {
    setActing(true);
    try {
      const body  = JSON.stringify({ action, user_id: ambId, data: payload });
      const res = await fetch('/api/ambassador', { method: 'POST', credentials: 'include', body });
      if (res.ok) {
        showToast('Erfolgreich', 'success');
        onRefresh();
        loadDetail();
      } else {
        const e = await res.json();
        showToast(e.error || 'Fehler', 'error');
      }
    } finally {
      setActing(false);
    }
  };

  // Daten aus neuer API-Struktur (refLinks, applications, referrals, stats)
  const profile    = (detail?.profile      || {}) as Record<string, unknown>;
  const refLinks   = detail?.refLinks       || [];
  const apps       = detail?.applications   || [];
  const referrals  = detail?.referrals      || [];
  const stats      = detail?.stats          || { total: 0, active: 0, sleeping: 0 };
  const logs: { id: string; type: string; metadata: Record<string,unknown>; created_at: string }[] = [];
  const works      = (detail as any)?.works    ?? [] as { id:string; title:string; status:string; approval_status:string|null; created_at:string }[];
  const projItems  = (detail as any)?.projects ?? [] as { id:string; project_name:string; status:string; funding_goal:number|null; created_at:string }[];

  const pm         = (profile.profile_modules as Record<string, unknown>) || {};
  const ambData    = (pm.ambassador as Record<string, unknown>) || {};
  const refLinkRow = refLinks[0] as Record<string, unknown> | undefined;

  const refCount   = Number(ambData.referral_count) || stats.total || 0;
  // COM-MIGRATION-015.3: Level-Slugs verschoben (gleiche Schwellen, neue Namen -- siehe ambassador-levels.ts)
  const safeLevel  = ((): AmbLevel => {
    if (refCount >= 201) return 'gold';
    if (refCount >= 51)  return 'silver';
    if (refCount >= 11)  return 'bronze';
    return 'starter';
  })();
  const lc        = LEVEL_CONFIG[safeLevel];
  const lcBorder  = '1px solid ' + lc.color + '44';
  const lcBorderL = '4px solid ' + lc.color;

  const ambRecord = {
    is_ambassador:   profile.is_ambassador,
    status:          'active',
    referral_link:   String(refLinkRow?.ref_link    || ambData.referral_link || '—'),
    referral_code:   String(refLinkRow?.referral_code || ambData.referral_code || '—'),
    link_active:     refLinkRow ? true : ambData.link_active !== false,
    activated_at:    ambData.activated_at as string | undefined,
    referral_count:  refCount,
    revenue_generated: Number(ambData.revenue_generated) || 0,
  };
  const isActive    = profile.is_ambassador === true;
  const displayName = String(profile.display_name || profile.username || ambId.slice(0, 8));

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199, backdropFilter: 'blur(4px)' }}
      />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 520, background: 'var(--bg-primary)', borderLeft: '1px solid var(--border)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>👤 Ambassador-Detail</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Lade…</div>
        ) : !detail ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Nicht gefunden</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* Profil-Header */}
            <div style={{ padding: '20px', borderBottom: lcBorderL, background: lc.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#0F1117', flexShrink: 0, border: lcBorder }}>
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{String(profile.username || '—')}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: lc.bg, color: lc.color, border: lcBorder }}>{lc.icon} {lc.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: isActive ? 'rgba(81,207,102,0.12)' : 'var(--bg-tertiary)', color: isActive ? 'var(--green)' : 'var(--text-muted)', border: isActive ? '1px solid rgba(81,207,102,0.3)' : '1px solid var(--border)' }}>{isActive ? '✅ Aktiv' : '⏸ Inaktiv'}</span>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { label: 'Referrals', value: String((ambRecord as { referral_count?: number }).referral_count || 0) },
                  { label: 'Umsatz', value: '€' + Number((ambRecord as { revenue_generated?: number }).revenue_generated || 0).toFixed(0) },
                  { label: 'Trust Score', value: String(Number(profile.trust_score) || 0) },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: lc.color }}>{stat.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
              {([['overview','Übersicht'],['referrals','Referrals'],['commissions','Provisionen'],['works','Werke'],['projects','Projekte'],['logs','Aktivität']] as [string,string][]).map(([tab,label]) => (
                <button key={tab} onClick={() => setDrawerTab(tab as typeof drawerTab)} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: drawerTab === tab ? 'var(--accent)' : 'var(--text-muted)', borderBottom: drawerTab === tab ? '2px solid var(--accent)' : '2px solid transparent' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab: Übersicht */}
            {drawerTab === 'overview' && (
              <div style={{ padding: 16 }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
                  {([
                    ['__email__', profile.email as string || null],
                    ['__phone__', (profile as Record<string,unknown>).phone as string || null],
                    ['Rolle', (profile.role as string) || '—'],
                    ['Mitglied seit', fmtDate(profile.created_at as string)],
                    ['Aktiviert am', fmtDate(ambRecord.activated_at || '')],
                    ['Referral-Code', ambRecord.referral_code || '—'],
                    ['Link-Status', ambRecord.link_active ? '🔗 Aktiv' : '🔒 Gesperrt'],
                  ] as [string, string|null][]).map(([k, v]) => {
                    const isEmail = k === '__email__';
                    const isPhone = k === '__phone__';
                    const label   = isEmail ? 'E-Mail' : isPhone ? 'Telefon' : k;
                    const display = v || '—';
                    return (
                    <div key={k} style={{ display: 'flex', padding: '8px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{label}</span>
                      {v && (isEmail || isPhone) ? (
                        <a href={isEmail ? `mailto:${v}` : `tel:${v}`}
                          style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                          {isEmail ? '✉️ ' : '📞 '}{display}
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{display}</span>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* Aktionen */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Aktionen</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {!isActive && (
                    <button onClick={() => act('activate')} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(81,207,102,0.4)', background: 'rgba(81,207,102,0.1)', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      ⚡ Aktivieren
                    </button>
                  )}
                  {isActive && (
                    <button onClick={() => act('revoke')} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,100,100,0.4)', background: 'rgba(255,100,100,0.1)', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      🚫 Entziehen
                    </button>
                  )}
                  {isActive && !ambRecord.link_active && (
                    <button onClick={() => act('toggle_link', { active: true })} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      🔗 Link freigeben
                    </button>
                  )}
                  {isActive && ambRecord.link_active && (
                    <button onClick={() => act('toggle_link', { active: false })} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      🔒 Link sperren
                    </button>
                  )}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowLevelMenu(v => !v)} disabled={acting} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      ⬆️ Level ändern
                    </button>
                    {showLevelMenu && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, minWidth: 130 }}>
                        {(['bronze','silver','gold','platinum'] as AmbLevel[]).map(lvl => (
                          <button key={lvl} onClick={() => { act('set_level', { level: lvl }); setShowLevelMenu(false); }} style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12, color: LEVEL_CONFIG[lvl].color, fontWeight: safeLevel === lvl ? 700 : 400 }}>
                            {LEVEL_CONFIG[lvl].icon} {LEVEL_CONFIG[lvl].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Referrals */}
            {drawerTab === 'referrals' && (
              <ReferralTabContent referrals={referrals} />
            )}

            {/* Tab: Provisionen (COM-MIGRATION-015.3) */}
            {drawerTab === 'commissions' && (
              <CommissionTabContent ambId={ambId} />
            )}

            {/* Tab: Werke */}
            {drawerTab === 'works' && (
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {works.length} Werk{works.length !== 1 ? 'e' : ''}
                </div>
                {works.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>Keine Werke vorhanden</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {works.map((w: any) => (
                      <div key={w.id} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{w.title || '(kein Titel)'}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                            background: w.approval_status === 'approved' ? 'rgba(34,197,94,0.12)' : w.approval_status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                            color:      w.approval_status === 'approved' ? '#22C55E'              : w.approval_status === 'rejected' ? '#EF4444'              : '#F59E0B',
                          }}>{w.approval_status || w.status || 'pending'}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {w.created_at ? new Date(w.created_at).toLocaleDateString('de-DE') : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Projekte */}
            {drawerTab === 'projects' && (
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {projItems.length} Projekt{projItems.length !== 1 ? 'e' : ''}
                </div>
                {projItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>Keine Projekte vorhanden</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {projItems.map((p: any) => (
                      <div key={p.id} style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{p.project_name || '(kein Name)'}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                            background: p.status === 'approved' ? 'rgba(34,197,94,0.12)' : p.status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                            color:      p.status === 'approved' ? '#22C55E'              : p.status === 'rejected' ? '#EF4444'              : '#F59E0B',
                          }}>{p.status}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {p.funding_goal ? `€${p.funding_goal.toLocaleString('de-DE')} Ziel · ` : ''}
                          {p.created_at ? new Date(p.created_at).toLocaleDateString('de-DE') : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Logs */}
            {drawerTab === 'logs' && (
              <div style={{ padding: 16 }}>
                {logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>Keine Aktivitäten</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {logs.map((log, idx) => (
                      <div key={log.id || idx} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{LOG_ICONS_MAP[log.type] || '📌'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{log.type.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtTime(log.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
