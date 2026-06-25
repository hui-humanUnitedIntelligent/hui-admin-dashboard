// frontend/src/app/audit/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { sbQuery } from '@/lib/api';

interface AuditEntry {
  id: string;
  table_name?: string;
  action?: string;
  record_id?: string;
  changed_by?: string;
  changed_at?: string;
  old_data?: unknown;
  new_data?: unknown;
  created_at: string;
  event_type?: string;
  user_id?: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `vor ${h} Std`;
  return new Date(iso).toLocaleDateString('de-DE');
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'var(--green)', DELETE: 'var(--red)',
  UPDATE: 'var(--gold)', SELECT: 'var(--text-muted)',
  signup: 'var(--accent)', login: 'var(--blue)',
};

export default function AuditPage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'auth_events'|'notifications'>('notifications');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try different audit-like tables
      const rows = await sbQuery<AuditEntry>(source, {}, {
        select: '*',
        order: 'created_at.desc',
        limit: 100,
      });
      setEntries(rows);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, [source]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout title="Audit Logs" headerActions={
      <button onClick={load} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
      <PageHeader
        title="Audit Logs"
        subtitle="Administrative Aktionen & Protokolle"
        actionsRole="superadmin"
        userRole={userRole}
      />
↻ Refresh</button>
    }>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['notifications','auth_events'] as const).map((s) => (
          <button key={s} onClick={() => setSource(s)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: `1px solid ${source === s ? 'var(--accent)' : 'var(--border)'}`, background: source === s ? 'var(--accent-dim)' : 'transparent', color: source === s ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Live Audit Log — {source}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loading ? '…' : `${entries.length} Einträge`}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['ID', 'User ID', 'Typ / Event', 'Details', 'Zeit'].map((h) => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(5)].map((_, j) => (
                    <td key={j} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: '60%' }} />
                    </td>
                  ))}</tr>
                ))
              ) : entries.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  Keine Einträge in dieser Tabelle. Die HUI App hat möglicherweise eine eigene Audit-Tabelle — prüfe das Supabase-Schema.
                </td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="tr-hover">
                    <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{e.id.slice(0,8)}…</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{(e.user_id || e.changed_by || '—').slice(0,8)}…</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: ACTION_COLORS[e.action || e.event_type || ''] || 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {e.action || e.event_type || '—'}
                      </span>
                      {e.table_name && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>· {e.table_name}</span>}
                    </td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', fontSize: 11, borderBottom: '1px solid var(--border)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.record_id ? `Record: ${e.record_id.slice(0,8)}` : JSON.stringify(e.new_data || '').slice(0, 60) + '…'}
                    </td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{timeAgo(e.changed_at || e.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
