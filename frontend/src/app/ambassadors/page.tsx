// frontend/src/app/ambassadors/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/hooks/useAuth';
import { PayoutsPanel } from '@/components/views/PayoutsPanel';

interface ReferredUser {
  id: string; displayName: string; username: string;
  avatarUrl: string | null; email: string | null;
  joinedAt: string; firstTransaction: string | null; isActive: boolean;
}

interface Ambassador {
  id: string; displayName: string; username: string;
  avatarUrl: string | null; email: string | null;
  impactEur: number; createdAt: string;
  referralCode: string | null; referralLink: string | null;
  referralCount: number; activeCount: number; sleepingCount: number;
  revenueEur: number; level: string; levelLabel: string; levelColor: string;
  linkActive: boolean; activatedAt: string | null;
  referredUsers: ReferredUser[];
}

function fmtEur(n: number | null | undefined) {
  const v = n ?? 0;
  if (v >= 1000) return `€${(v/1000).toFixed(1)}K`;
  return `€${v.toFixed(2)}`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtShort(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
}

// ── Kacheln-Info-Popup ────────────────────────────────────────
function TileInfoPopup({ onClose }: { onClose: () => void }) {
  const items: { icon: string; label: string; text: string }[] = [
    { icon:'👥', label:'Geworbene',    text:'Anzahl Nutzer, die sich über den persönlichen Einladungslink dieses Ambassadors registriert haben (profiles.referred_by).' },
    { icon:'⚡', label:'Aktiv',        text:'Von den Geworbenen: wie viele haben mindestens einen bezahlten Kauf getätigt (profiles.first_transaction_at gesetzt).' },
    { icon:'😴', label:'Schlafend',    text:'Von den Geworbenen: wie viele haben sich zwar registriert, aber noch nie etwas gekauft.' },
    { icon:'💰', label:'Umsatz',       text:'Gesamtsumme aller bezahlten Bestellungen, die diesem Ambassador zugeordnet sind (stripe_payments.ambassador_id) — nicht nur von Geworbenen mit gültigem 365-Tage-Fenster.' },
    { icon:'🌿', label:'Impact',       text:'Der Impact-Pool-Anteil (6% vom Umsatz / 30% des HUI-Anteils) aus genau diesen dem Ambassador zugeordneten Transaktionen.' },
    { icon:'🔗', label:'Link-Status',  text:'Ob der persönliche Einladungslink aktuell freigegeben (Aktiv) oder gesperrt (Inaktiv) ist.' },
  ];
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:10010,
      background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'0 20px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', maxWidth:440, maxHeight:'80vh', overflowY:'auto',
        background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:14,
        padding:'20px 22px', boxShadow:'0 8px 40px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ fontSize:14, fontWeight:700 }}>ℹ️ Was bedeuten die Kacheln?</div>
          <button onClick={onClose} style={{ background:'var(--bg-tertiary)', border:'1px solid var(--border)', borderRadius:8, padding:'4px 10px', color:'var(--text-muted)', cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {items.map(it => (
            <div key={it.label} style={{ display:'flex', gap:10, padding:'10px 12px', background:'var(--bg-tertiary)', borderRadius:10 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{it.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:2 }}>{it.label}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>{it.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Detail-Drawer ─────────────────────────────────────────────
function AmbassadorDrawer({ amb, onClose }: { amb: Ambassador; onClose: () => void }) {
  const [showTileInfo, setShowTileInfo] = useState(false);
  const progressMax = amb.level === 'Platin' ? 201 : amb.level === 'Gold' ? 51 : amb.level === 'Silber' ? 11 : 10;
  const progressPct = Math.min(100, (amb.referralCount / progressMax) * 100);

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:10000,
      background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'flex-start', justifyContent:'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 500, height: '100vh',
        background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-primary)', position:'sticky', top:0, zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {amb.avatarUrl ? (
              <img src={amb.avatarUrl} alt="" style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover' }} />
            ) : (
              <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#fff' }}>
                {(amb.displayName?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>{amb.displayName}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>@{amb.username} · {amb.email ?? '—'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'var(--bg-tertiary)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', color:'var(--text-muted)', cursor:'pointer', fontSize:13 }}>✕ Schließen</button>
        </div>

        <div style={{ padding:'20px 24px', flex:1, display:'flex', flexDirection:'column', gap:20 }}>

          {/* Level + Progress */}
          <div style={{ background:'var(--bg-tertiary)', borderRadius:12, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:700, color: amb.levelColor }}>{amb.levelLabel}</span>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>Aktiv seit {fmtShort(amb.activatedAt ?? amb.createdAt)}</span>
            </div>
            <div style={{ background:'var(--bg-secondary)', borderRadius:99, height:8, overflow:'hidden' }}>
              <div style={{ width:`${progressPct}%`, height:'100%', background: amb.levelColor, borderRadius:99, transition:'width .4s' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
              {amb.referralCount} / {progressMax} Referrals für nächstes Level
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', marginBottom:-4 }}>
            <button onClick={() => setShowTileInfo(true)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', gap:4, padding:'2px 4px' }}>
              ℹ️ Was bedeutet das?
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[
              { label:'Geworbene', val: String(amb.referralCount), icon:'👥', color:'var(--accent)' },
              { label:'Aktiv', val: String(amb.activeCount), icon:'⚡', color:'#51cf66' },
              { label:'Schlafend', val: String(amb.sleepingCount), icon:'😴', color:'var(--text-muted)' },
              { label:'Umsatz', val: fmtEur(amb.revenueEur), icon:'💰', color:'#ffd43b' },
              { label:'Impact', val: fmtEur(amb.impactEur), icon:'🌿', color:'#74c0fc' },
              { label:'Link-Status', val: amb.linkActive ? 'Aktiv' : 'Inaktiv', icon:'🔗', color: amb.linkActive ? '#51cf66' : '#ff6b6b' },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--bg-tertiary)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                <div style={{ fontSize:16, fontWeight:800, color: s.color, fontFamily:'var(--font-mono)' }}>{s.val}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Ref-Link */}
          {amb.referralLink && (
            <div style={{ background:'var(--bg-tertiary)', borderRadius:10, padding:'12px 16px' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>🔗 Persönlicher Einladungslink</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <code style={{ flex:1, fontSize:12, color:'var(--accent)', background:'var(--bg-secondary)', padding:'6px 10px', borderRadius:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {amb.referralLink}
                </code>
                <button onClick={() => navigator.clipboard.writeText(amb.referralLink!)} style={{ padding:'6px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-muted)', cursor:'pointer', fontSize:11, flexShrink:0 }}>
                  Kopieren
                </button>
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Code: {amb.referralCode ?? '—'}</div>
            </div>
          )}

          {/* Geworbene Nutzer */}
          <div>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>
              👥 Geworbene Mitglieder ({amb.referralCount})
            </div>
            {amb.referredUsers.length === 0 ? (
              <div style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:13, background:'var(--bg-tertiary)', borderRadius:10 }}>
                Noch keine geworbenen Mitglieder
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {amb.referredUsers.map(u => (
                  <div key={u.id} style={{ background:'var(--bg-tertiary)', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    ) : (
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {(u.displayName?.[0] ?? '?').toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.displayName}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:20,
                          background: u.isActive ? 'rgba(81,207,102,0.12)' : 'rgba(255,255,255,0.06)',
                          color: u.isActive ? '#51cf66' : 'var(--text-muted)' }}>
                          {u.isActive ? '⚡ aktiv' : '😴 schlafend'}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>@{u.username} · Reg. {fmtShort(u.joinedAt)}</div>
                      {u.firstTransaction && (
                        <div style={{ fontSize:11, color:'#51cf66' }}>💳 Erste Zahlung {fmtShort(u.firstTransaction)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
      {showTileInfo && <TileInfoPopup onClose={() => setShowTileInfo(false)} />}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function AmbassadorsPage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [toast,       setToast]       = useState('');
  const [acting,      setActing]      = useState<string | null>(null);
  const [selected,    setSelected]    = useState<Ambassador | null>(null);
  // AMB-PAYOUT-MODAL-FOLLOWUP (2026-07-04, Michael): Auszahlungen öffnen sich als Fenster
  // direkt hier im Ambassador-Bereich statt auf eine separate Seite zu navigieren.
  const [payoutModalTab, setPayoutModalTab] = useState<'requested' | 'approved' | 'paid' | null>(null);
  const PAYOUT_TILE_TO_TAB: Record<'requested' | 'pending' | 'done', 'requested' | 'approved' | 'paid'> = {
    requested: 'requested', pending: 'approved', done: 'paid',
  };

  // AMB-BANK-PAYOUT-001: Auszahlungsanfragen-Kacheln oben (nur SADB -- diese Seite ist bereits
  // superadminOnly in der Navigation, siehe navigation.ts).
  const [payoutStats, setPayoutStats] = useState<{
    requested: { count: number; eur: number };
    pending:   { count: number; eur: number };
    done:      { count: number; eur: number };
  } | null>(null);

  const loadPayoutStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stripe?type=ambassador_payout_stats', { credentials: 'include' });
      const json = await res.json();
      if (json?.ok) setPayoutStats(json.data);
    } catch (e) { console.error('[ambassadors payout stats]', e); }
  }, []);

  useEffect(() => { loadPayoutStats(); const iv = setInterval(loadPayoutStats, 30_000); return () => clearInterval(iv); }, [loadPayoutStats]);

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/ambassador?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAmbassadors(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error('[ambassadors]', e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  // Realtime: alle 30s refreshen
  useEffect(() => {
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  async function removeAmbassador(a: Ambassador) {
    if (userRole !== 'superadmin') return;
    if (!confirm(`Ambassador-Status von ${a.displayName} entfernen?`)) return;
    setActing(a.id);
    try {
      const res = await fetch('/api/ambassador', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: a.id, action: 'deactivate' }),
      });
      if (res.ok) { showToast('✅ Ambassador entfernt'); load(); }
      else showToast('Fehler beim Speichern');
    } finally { setActing(null); }
  }

  const totalRevenue  = ambassadors.reduce((s, a) => s + (a.revenueEur ?? 0), 0);
  const totalReferrals = ambassadors.reduce((s, a) => s + (a.referralCount ?? 0), 0);
  const totalActive   = ambassadors.reduce((s, a) => s + (a.activeCount ?? 0), 0);

  const th: React.CSSProperties = { padding:'10px 14px', textAlign:'left', fontSize:10, textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text-muted)', fontWeight:600 };
  const td: React.CSSProperties = { padding:'10px 14px' };

  return (
    <DashboardLayout title="Ambassadors">
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:'var(--accent)', color:'#fff', padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:600 }}>
          {toast}
        </div>
      )}

      {selected && <AmbassadorDrawer amb={selected} onClose={() => setSelected(null)} />}

      <PageHeader title="Ambassadors" subtitle="Referral-Partner & Markenbotschafter" actionsRole={userRole as 'superadmin' | 'employee'} userRole={userRole} />

      {/* AMB-BANK-PAYOUT-001: Auszahlungsanfragen -- oben, nur SADB */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:8 }}>
          💸 Auszahlungsanfragen
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
          {[
            { key:'requested', label:'Anfragen',  sub:'wartet auf Genehmigung', icon:'📥', color:'#ffd43b' },
            { key:'pending',   label:'Pending',    sub:'genehmigt, wird überwiesen', icon:'⏳', color:'#74c0fc' },
            { key:'done',      label:'Erledigt',   sub:'ausgezahlt', icon:'✅', color:'#51cf66' },
          ].map(t => {
            const s = payoutStats?.[t.key as 'requested' | 'pending' | 'done'];
            return (
              <div key={t.key}
                onClick={() => setPayoutModalTab(PAYOUT_TILE_TO_TAB[t.key as 'requested' | 'pending' | 'done'])}
                style={{
                  background:'var(--bg-secondary)', border:`1px solid ${t.color}44`, borderRadius:12,
                  padding:'16px 18px', cursor:'pointer', transition:'border-color 0.15s',
                }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>
                    {t.icon} {t.label}
                  </div>
                  <div style={{ fontSize:22, fontWeight:700, color:t.color, fontFamily:'var(--font-mono)' }}>
                    {s ? s.count : '–'}
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                    {s ? `${fmtEur(s.eur)} · ${t.sub}` : t.sub}
                  </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Ambassadors', val: String(ambassadors.length), icon:'🤝' },
          { label:'Gesamtumsatz', val: fmtEur(totalRevenue), icon:'💰' },
          { label:'Alle Referrals', val: String(totalReferrals), icon:'🔗' },
          { label:'Aktive Mitgl.', val: String(totalActive), icon:'⚡' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--accent)', fontFamily:'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Suche + Refresh */}
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Name, E-Mail oder Username..."
          style={{ flex:1, maxWidth:400, padding:'8px 14px', background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }} />
        <button onClick={load} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-muted)', cursor:'pointer', fontSize:12 }}>
          🔄 Aktualisieren
        </button>
      </div>

      {/* Tabelle */}
      {loading ? (
        <div style={{ color:'var(--text-muted)', padding:40, textAlign:'center' }}>Lade Ambassadors...</div>
      ) : ambassadors.length === 0 ? (
        <div style={{ color:'var(--text-muted)', padding:40, textAlign:'center' }}>Keine Ambassadors gefunden.</div>
      ) : (
        <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-tertiary)' }}>
                <th style={th}>Ambassador</th>
                <th style={th}>Level</th>
                <th style={th}>Referrals</th>
                <th style={th}>Aktiv / Schlafend</th>
                <th style={th}>Umsatz</th>
                <th style={th}>Ref-Link</th>
                <th style={th}>Seit</th>
                {userRole === 'superadmin' && <th style={th}>Aktion</th>}
              </tr>
            </thead>
            <tbody>
              {ambassadors.map((a, idx) => (
                <tr key={a.id}
                  onClick={() => setSelected(a)}
                  style={{ borderBottom: idx < ambassadors.length-1 ? '1px solid var(--border)' : 'none', cursor:'pointer', transition:'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={td}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {a.avatarUrl ? (
                        <img src={a.avatarUrl} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover' }} />
                      ) : (
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff' }}>
                          {(a.displayName?.[0] ?? '?').toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight:600 }}>{a.displayName || a.username || '—'}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{a.email ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:`${a.levelColor}22`, color: a.levelColor }}>{a.levelLabel}</span>
                  </td>
                  <td style={{ ...td, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--accent)' }}>{a.referralCount}</td>
                  <td style={td}>
                    <span style={{ color:'#51cf66', fontWeight:600 }}>{a.activeCount}</span>
                    <span style={{ color:'var(--text-muted)', fontSize:11 }}> / {a.sleepingCount}</span>
                  </td>
                  <td style={{ ...td, fontFamily:'var(--font-mono)', fontWeight:700, color: a.revenueEur > 0 ? '#51cf66' : 'var(--text-muted)' }}>{fmtEur(a.revenueEur)}</td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    {(() => {
                      // Autoritative Quelle: profiles.username → https://be-hui.com/<username>
                      const link = a.referralLink || (a.username ? `https://be-hui.com/${a.username}` : null);
                      if (!link) return <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>;
                      const displayText = link.replace('https://be-hui.com/', 'be-hui.com/');
                      return (
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <a href={link} target="_blank" rel="noreferrer"
                            style={{ color:'var(--accent)', fontSize:11, textDecoration:'none', wordBreak:'break-all' }}>
                            {displayText}
                          </a>
                          <button
                            onClick={() => navigator.clipboard.writeText(link)}
                            title="Link kopieren"
                            style={{ border:'none', background:'transparent', cursor:'pointer', color:'var(--text-muted)', fontSize:12, padding:'0 2px', flexShrink:0 }}>
                            📋
                          </button>
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ ...td, color:'var(--text-muted)', fontSize:12 }}>{fmtDate(a.createdAt)}</td>
                  {userRole === 'superadmin' && (
                    <td style={td} onClick={e => e.stopPropagation()}>
                      <button disabled={acting === a.id} onClick={() => removeAmbassador(a)}
                        style={{ padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:600, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-muted)', cursor: acting === a.id ? 'not-allowed' : 'pointer', opacity: acting === a.id ? 0.5 : 1 }}>
                        {acting === a.id ? '...' : 'Entfernen'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AMB-PAYOUT-MODAL-FOLLOWUP (2026-07-04): Auszahlungen-Fenster -- zentriertes Modal,
          bewusst KEIN Side-Drawer (anders als AmbassadorDrawer oben). Bleibt vollständig im
          Ambassador-Bereich, keine Navigation/URL-Wechsel, kein Sidebar/Layout-Wechsel. */}
      {payoutModalTab && (
        <div onClick={() => setPayoutModalTab(null)} style={{
          position:'fixed', inset:0, zIndex:10010,
          background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width:'100%', maxWidth:1100, maxHeight:'88vh', overflowY:'auto',
            background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:16,
            padding:'22px 24px', boxShadow:'0 12px 50px rgba(0,0,0,0.4)',
          }}>
            <PayoutsPanel role="superadmin" initialStatus={payoutModalTab} onClose={() => setPayoutModalTab(null)} />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
