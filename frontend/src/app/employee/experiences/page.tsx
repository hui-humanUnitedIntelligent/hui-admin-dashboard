// frontend/src/app/employee/experiences/page.tsx
// READ-ONLY Employee-Ansicht: Erlebnisse & Projekte
'use client';
import { useState, useCallback, useEffect } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { getSessionToken } from '@/lib/session';

interface Experience {
  id: string;
  title?: string;
  category?: string;
  price?: number;
  status?: string;
  approval_status?: string;
  created_at?: string;
  user_id?: string;
}

const STATUS_VARIANT: Record<string, 'success'|'warning'|'danger'|'neutral'> = {
  approved: 'success', pending: 'warning', rejected: 'danger', draft: 'neutral',
};

function fmtPrice(n?: number) {
  if (!n) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function timeAgo(iso?: string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'Heute';
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d/7)}w`;
  return `${Math.floor(d/30)}mo`;
}

export default function EmployeeExperiencesPage() {
  const [items,   setItems]   = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [tab,     setTab]     = useState<'all'|'approved'|'pending'|'rejected'>('all');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getSessionToken();
      const res = await fetch('/api/experiences', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setItems(j.data ?? []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(e => {
    const matchTab = tab === 'all' || e.approval_status === tab || e.status === tab;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (e.title || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  return (
    <EmployeeLayout title="Erlebnisse & Projekte">
      <PageHeader title="Erlebnisse & Projekte" subtitle="Read-only Übersicht" actionsRole="employee" />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['all','approved','pending','rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
            background: tab === t ? 'var(--accent)' : 'transparent',
            color: tab === t ? '#0f1117' : 'var(--text-muted)',
            fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>
            {t === 'all' ? 'Alle' : t === 'approved' ? 'Genehmigt' : t === 'pending' ? 'Ausstehend' : 'Abgelehnt'}
          </button>
        ))}
        <input type="text" placeholder="Titel oder Kategorie…" value={search} onChange={e => setSearch(e.target.value)} style={{
          marginLeft: 'auto', padding: '6px 12px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
          color: 'var(--text-primary)', fontSize: 12, minWidth: 180,
        }} />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Laden…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Titel','Kategorie','Preis','Status','Erstellt'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{e.title || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{e.category || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{fmtPrice(e.price)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <Badge variant={STATUS_VARIANT[e.approval_status || e.status || ''] ?? 'neutral'}>
                      {e.approval_status === 'approved' ? 'Genehmigt' : e.approval_status === 'pending' ? 'Ausstehend' : e.approval_status === 'rejected' ? 'Abgelehnt' : e.status || '—'}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{timeAgo(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Keine Erlebnisse gefunden.</div>}
        </div>
      )}
    </EmployeeLayout>
  );
}
