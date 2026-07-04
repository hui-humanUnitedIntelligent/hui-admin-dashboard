'use client';
// frontend/src/app/audit/page.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import PaginationControls from '@/components/ui/PaginationControls';

// ── Typen ─────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

interface TabConfig {
  key: string;
  label: string;
  icon: string;
  cols: { key: string; label: string; width?: number }[];
}

const TABS: TabConfig[] = [
  { key: 'notifications', label: 'Benachrichtigungen', icon: '🔔',
    cols: [
      { key: 'created_at', label: 'Zeit', width: 130 },
      { key: 'type',       label: 'Typ',  width: 180 },
      { key: 'title',      label: 'Titel' },
      { key: 'user_id',    label: 'User-ID', width: 110 },
      { key: 'is_read',    label: 'Gelesen', width: 80 },
    ],
  },
  { key: 'registrations', label: 'Registrierungen', icon: '👤',
    cols: [
      { key: 'created_at',   label: 'Zeit',         width: 130 },
      { key: 'display_name', label: 'Name' },
      { key: 'username',     label: 'Username',     width: 130 },
      { key: 'email',        label: 'E-Mail' },
      { key: 'role',         label: 'Rolle',        width: 90 },
    ],
  },
  { key: 'works', label: 'Werke', icon: '🎨',
    cols: [
      { key: 'created_at', label: 'Zeit',     width: 130 },
      { key: 'title',      label: 'Titel' },
      { key: 'category',   label: 'Kategorie', width: 130 },
      { key: 'status',     label: 'Status',    width: 100 },
      { key: 'price_eur',  label: 'Preis €',   width: 90 },
    ],
  },
  { key: 'experiences', label: 'Erlebnisse', icon: '🌿',
    cols: [
      { key: 'created_at',     label: 'Zeit',   width: 130 },
      { key: 'title',          label: 'Titel' },
      { key: 'experience_type',label: 'Typ',    width: 110 },
      { key: 'status',         label: 'Status', width: 100 },
      { key: 'price',          label: 'Preis',  width: 90 },
    ],
  },
  { key: 'impact', label: 'Impact Bewerbungen', icon: '🚀',
    cols: [
      { key: 'created_at',    label: 'Zeit',        width: 130 },
      { key: 'project_name',  label: 'Projekt' },
      { key: 'contact_name',  label: 'Kontakt',     width: 140 },
      { key: 'contact_email', label: 'E-Mail',      width: 180 },
      { key: 'status',        label: 'Status',      width: 100 },
    ],
  },
  { key: 'reviews', label: 'Website Reviews', icon: '⭐',
    cols: [
      { key: 'created_at', label: 'Zeit',    width: 130 },
      { key: 'name',       label: 'Name',    width: 140 },
      { key: 'stars',      label: '★',       width: 60 },
      { key: 'status',     label: 'Status',  width: 100 },
      { key: 'message',    label: 'Kommentar' },
    ],
  },
];

const PAGE_SIZE = 10;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function fmtTime(v: unknown): string {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return new Date(s).toLocaleString('de-DE', {
      day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit',
    });
  }
  return s;
}

function fmtVal(col: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (col === 'created_at') return fmtTime(v);
  if (typeof v === 'boolean') return v ? 'ja' : 'nein';
  if (col === 'user_id' || col === 'chat_id') return String(v).slice(0, 8) + '…';
  if (col === 'price_eur' || col === 'price') {
    const n = parseFloat(String(v));
    return isNaN(n) ? '—' : `€ ${n.toFixed(2)}`;
  }
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}

function StatusBadge({ val }: { val: string }) {
  const colors: Record<string, string> = {
    published: 'var(--green)', approved: 'var(--green)', true: 'var(--green)',
    pending:   'var(--gold)',  submitted: 'var(--gold)',  draft: 'var(--gold)',
    deleted:   'var(--red)',   rejected: 'var(--red)',    false: 'var(--text-muted)',
  };
  const c = colors[val.toLowerCase()] ?? 'var(--text-secondary)';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: c,
      background: c + '18', padding: '2px 7px', borderRadius: 5,
      textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {val}
    </span>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function AuditPage() {
  const [activeTab, setActiveTab]   = useState('notifications');
  const [rows, setRows]             = useState<Row[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (tab: string, q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tab, search: q,
        limit: String(PAGE_SIZE),
        offset: String((p - 1) * PAGE_SIZE),
      });
      const res = await fetch(`/api/audit?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? 'Fehler'); setRows([]); setTotal(0); }
      else { setRows(json.data ?? []); setTotal(json.total ?? 0); }
    } catch (e) {
      setError('Verbindung unterbrochen: ' + (e instanceof Error ? e.message : String(e)));
      setRows([]);
    } finally {
      setLoading(false);
      setLastUpdate(new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));
    }
  }, []);

  // Tab oder Suche ändert sich → zurück auf Seite 1 + neu laden
  useEffect(() => { setPage(1); }, [activeTab, search]);
  useEffect(() => { load(activeTab, search, page); }, [activeTab, search, page, load]);

  // Auto-Refresh alle 30s (aktuelle Seite)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(() => load(activeTab, search, page), 30_000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, activeTab, search, page, load]);

  const tab = TABS.find(t => t.key === activeTab)!;
  const isStatus = (col: string) => ['status','is_read'].includes(col);

  return (
    <DashboardLayout>
      <PageHeader
        title="Audit Logs"
        subtitle="Administrative Aktionen & Protokolle — Live"
        actions={
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12,
              color:'var(--text-muted)', cursor:'pointer' }}>
              <input type="checkbox" checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                style={{ accentColor:'var(--accent)', width:13, height:13 }} />
              Live (30s)
            </label>
            <button onClick={() => load(activeTab, search, page)} disabled={loading}
              style={{ padding:'0 12px', height:30, borderRadius:6, fontSize:12, fontWeight:600,
                border:'1px solid var(--accent)', background:'transparent', color:'var(--accent)',
                cursor:'pointer', opacity: loading ? 0.5 : 1 }}>
              {loading ? '⏳' : '↺ Aktualisieren'}
            </button>
          </div>
        }
      />

      <div style={{ padding:'0 28px 28px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:16, flexWrap:'wrap', borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setSearch(''); }}
              style={{ padding:'8px 14px', borderRadius:'6px 6px 0 0', fontSize:13, fontWeight:600,
                cursor:'pointer', border:'1px solid',
                borderBottom: t.key === activeTab ? '1px solid var(--bg-primary)' : '1px solid var(--border)',
                background:   t.key === activeTab ? 'var(--bg-primary)' : 'transparent',
                color:        t.key === activeTab ? 'var(--accent)' : 'var(--text-muted)',
                borderColor:  t.key === activeTab ? 'var(--border)' : 'transparent',
                marginBottom: -1,
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`In ${tab.label} suchen…`}
            style={{ flex:1, maxWidth:320, padding:'7px 12px', borderRadius:7, fontSize:13,
              border:'1px solid var(--border)', background:'var(--bg-secondary)',
              color:'var(--text-primary)', outline:'none' }}
          />
          <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:'auto' }}>
            {total} Einträge
            {lastUpdate && <> · zuletzt <strong style={{ color:'var(--accent)' }}>{lastUpdate}</strong></>}
          </span>
        </div>

        {/* Fehler */}
        {error && (
          <div style={{ padding:'12px 16px', borderRadius:8, background:'rgba(248,113,113,0.08)',
            border:'1px solid rgba(248,113,113,0.3)', color:'var(--red)', fontSize:13, marginBottom:12 }}>
            ⚠ {error}
          </div>
        )}

        {/* Tabelle */}
        <div style={{ borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
          {/* Header */}
          <div style={{ display:'grid',
            gridTemplateColumns: tab.cols.map(c => c.width ? `${c.width}px` : '1fr').join(' '),
            background:'var(--bg-tertiary)', borderBottom:'1px solid var(--border)',
            padding:'10px 16px', gap:8 }}>
            {tab.cols.map(c => (
              <span key={c.key} style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)',
                textTransform:'uppercase', letterSpacing:'0.06em', overflow:'hidden',
                textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {c.label}
              </span>
            ))}
          </div>

          {/* Rows */}
          {loading && rows.length === 0 ? (
            <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              ⏳ Lade Daten…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              Keine Einträge gefunden.
            </div>
          ) : (
            rows.map((row, i) => (
              <div key={String(row.id ?? i)}
                style={{ display:'grid',
                  gridTemplateColumns: tab.cols.map(c => c.width ? `${c.width}px` : '1fr').join(' '),
                  padding:'9px 16px', gap:8, alignItems:'center',
                  borderBottom: i < rows.length-1 ? '1px solid var(--border)' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  transition:'background 0.1s' }}>
                {tab.cols.map(c => {
                  const val = row[c.key];
                  const formatted = fmtVal(c.key, val);
                  return (
                    <span key={c.key}
                      style={{ fontSize:12, color: c.key === 'created_at' ? 'var(--text-muted)' : 'var(--text-primary)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {isStatus(c.key) && val !== null && val !== undefined
                        ? <StatusBadge val={String(val)} />
                        : formatted}
                    </span>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <PaginationControls
          visibleCount={rows.length}
          total={total}
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onGoToPage={setPage}
        />

      </div>
    </DashboardLayout>
  );
}
