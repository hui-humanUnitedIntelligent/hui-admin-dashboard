// frontend/src/components/views/ChurnsView.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { showToast } from '@/components/ui/Toast';

interface ChurnUser {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  membership_type: string | null;
  member_since: string | null;
  membership_active: boolean;
  is_member: boolean;
  is_wirker: boolean;
  last_seen: string | null;
  created_at: string;
  role: string;
}

type FilterPeriod = '7d' | '30d' | '90d' | '180d' | 'all';

function daysSince(iso: string | null): number {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const d = daysSince(iso);
  if (d === 0) return 'Heute';
  if (d < 30) return `Vor ${d}d`;
  if (d < 365) return `Vor ${Math.floor(d / 30)}mo`;
  return `Vor ${Math.floor(d / 365)}j`;
}

function avatarColor(id: string) {
  const c = ['#4ECDC4', '#F7B731', '#B197FC', '#74C0FC', '#51CF66', '#FF6B6B', '#FFA94D'];
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
}

const FILTER_LABELS: Record<FilterPeriod, string> = {
  '7d': 'Letzte 7 Tage', '30d': 'Letzte 30 Tage', '90d': 'Letzte 90 Tage', '180d': 'Letzte 6 Monate', all: 'Alle',
};

export function ChurnsView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const [allProfiles, setAllProfiles] = useState<ChurnUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [period, setPeriod]           = useState<FilterPeriod>('30d');
  const [tab, setTab]                 = useState<'inactive' | 'exmember' | 'atrisk'>('exmember');
  const [search, setSearch]           = useState('');
  const [sort, setSort]               = useState<'last_seen' | 'member_since' | 'name'>('last_seen');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin?table=profiles&select=id,display_name,username,avatar_url,email,membership_type,member_since,membership_active,is_member,is_wirker,last_seen,created_at,role&limit=2000')
      .then(r => r.json()).catch(() => []);
    setAllProfiles(Array.isArray(res) ? res : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const periodDays: Record<FilterPeriod, number> = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, all: 99999 };
  const maxDays = periodDays[period];

  // Categories
  const exMembers   = allProfiles.filter(u => u.is_member === false && u.member_since && ['member','wirker','premium'].includes(u.membership_type || '') === false && daysSince(u.member_since) <= maxDays);
  const inactiveUsers = allProfiles.filter(u => daysSince(u.last_seen) > 30 && daysSince(u.last_seen) <= Math.max(maxDays, 30));
  const atRisk      = allProfiles.filter(u => (u.is_member || u.is_wirker) && u.membership_active === false && daysSince(u.last_seen) > 14);

  // Tab selection
  const baseList = tab === 'exmember' ? exMembers : tab === 'inactive' ? inactiveUsers : atRisk;

  const filtered = baseList
    .filter(u => !search.trim() ||
      (u.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === 'last_seen')    return daysSince(a.last_seen) - daysSince(b.last_seen);
      if (sort === 'member_since') return daysSince(a.member_since) - daysSince(b.member_since);
      return (a.display_name || '').localeCompare(b.display_name || '');
    });

  // Send re-engagement broadcast
  const sendReengagement = async () => {
    if (!confirm(`Re-Engagement Broadcast an ${filtered.length} User senden?`)) return;
    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '👋 Wir vermissen dich!',
        body: 'Es ist eine Weile her — komm zurück zu HUI! Neue Funktionen, neue Wirker und neue Impact-Projekte warten auf dich.',
        target_group: 'all',
      }),
    });
    if ((res).ok) showToast(`Broadcast gesendet ✅`, 'success');
    else showToast('Fehler beim Senden', 'error');
  };

  const input: React.CSSProperties = {
    padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none',
  };

  const tabBtn = (v: typeof tab, label: string, count: number, color: string) => (
    <button onClick={() => setTab(v)} style={{
      padding: '6px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontFamily: 'var(--font-body)',
      borderColor: tab === v ? color : 'var(--border)',
      background: tab === v ? `${color}22` : 'transparent',
      color: tab === v ? color : 'var(--text-muted)',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label} <span style={{ fontSize: 10, opacity: 0.8 }}>({count})</span>
    </button>
  );

  return (
    <DashboardLayout
      employeeMode={role === 'employee'}
      title="Kündigungen"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          
      <PageHeader
        title="Kündigungen"
        subtitle="Abgelaufene Mitgliedschaften"
        actionsRole={role === 'employee' ? 'employee' : 'admin'}
        userRole={userRole}
      />

<select value={period} onChange={e => setPeriod(e.target.value as FilterPeriod)} style={{ ...input, fontSize: 11 }}>
            {(Object.keys(FILTER_LABELS) as FilterPeriod[]).map(k => <option key={k} value={k}>{FILTER_LABELS[k]}</option>)}
          </select>
          <button onClick={sendReengagement} style={{ padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: 8, fontSize: 11, color: '#0F1117', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
            📨 Re-Engagement senden
          </button>
          <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        {[
          { label: 'Ex-Mitglieder',     value: exMembers.length,    color: 'var(--red)',    icon: '📉', desc: 'Mitgliedschaft nicht verlängert' },
          { label: 'Inaktive User',     value: inactiveUsers.length, color: 'var(--gold)',  icon: '😴', desc: 'Kein Login seit 30+ Tagen' },
          { label: 'Abwanderungsgefahr',value: atRisk.length,        color: 'var(--purple)',icon: '⚠️', desc: 'Mitglied, aber inaktiv' },
        ].map(({ label, value, color, icon, desc }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', borderTop: `3px solid ${color}`, cursor: 'pointer' }} onClick={() => setTab(label === 'Ex-Mitglieder' ? 'exmember' : label === 'Inaktive User' ? 'inactive' : 'atrisk')}>
            <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{loading ? '…' : value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, marginTop: 4 }}>{icon} {label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search + Sort */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="tab-bar" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tabBtn('exmember', '📉 Ex-Mitglieder', exMembers.length, 'var(--red)')}
            {tabBtn('atrisk',   '⚠️ Abwanderungsgefahr', atRisk.length, 'var(--purple)')}
            {tabBtn('inactive', '😴 Inaktiv', inactiveUsers.length, 'var(--gold)')}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} className="filter-row">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" style={{ ...input, flex: 1 }} />
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} style={{ ...input }}>
              <option value="last_seen">Sortierung: Letzter Login</option>
              <option value="member_since">Sortierung: Mitglied seit</option>
              <option value="name">Sortierung: Name</option>
            </select>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {filtered.length} Ergebnisse · Zeitraum: {FILTER_LABELS[period]}
          </div>
        </div>

        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)' }}>
                {['User', 'Rolle', 'Mitgliedschaft', 'Letzter Login', 'Mitglied seit', 'Status', 'Aktion'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={7} style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ height: 12, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s infinite', width: '60%' }} />
                  </td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                  Keine Kündigungen im gewählten Zeitraum
                </td></tr>
              ) : filtered.map(u => {
                const lastSeenDays = daysSince(u.last_seen);
                const riskColor = lastSeenDays > 90 ? 'var(--red)' : lastSeenDays > 30 ? 'var(--gold)' : 'var(--green)';
                return (
                  <tr key={u.id} className="tr-hover">
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(u.id), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0F1117', overflow: 'hidden' }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                            : (u.display_name || u.username || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{u.display_name || '—'}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>@{u.username || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11 }} className="col-hide-mobile">{u.role}</td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                      <span style={{ color: u.membership_type === 'basisuser' ? 'var(--text-muted)' : 'var(--gold)' }}>{u.membership_type || '—'}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                      <span style={{ color: riskColor, fontWeight: 600 }}>{timeAgo(u.last_seen)}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11 }} className="col-hide-mobile">
                      {timeAgo(u.member_since)}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                      {tab === 'exmember' && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'var(--red-dim)', color: 'var(--red)', fontWeight: 700 }}>📉 Abgewandert</span>}
                      {tab === 'atrisk'   && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'var(--purple-dim)', color: 'var(--purple)', fontWeight: 700 }}>⚠️ Risiko</span>}
                      {tab === 'inactive' && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'var(--gold-dim)', color: 'var(--gold)', fontWeight: 700 }}>😴 Inaktiv</span>}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                      <button
                        onClick={async () => {
                          const res = await fetch('/api/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '👋 Wir vermissen dich!', body: `Hallo ${u.display_name || u.username}! Komm zurück zu HUI — neue Features warten auf dich.`, target_group: 'all' }) });
                          if ((res).ok) showToast('Nachricht gesendet', 'success');
                        }}
                        title="Direkte Nachricht senden"
                        style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}
                      >
                        📨
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
