// frontend/src/components/dashboard/RefreshBtn.tsx
// ── HUI Admin Dashboard — Einheitlicher Refresh-Button ───────────────────────
'use client';

interface RefreshBtnProps {
  onClick:  () => void;
  loading?: boolean;
  label?:   string;
}

export default function RefreshBtn({ onClick, loading = false, label }: RefreshBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={loading ? 'Wird aktualisiert' : 'Aktualisieren'}
      aria-busy={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 11px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 7,
        fontSize: 11.5, color: 'var(--text-secondary)',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'all 0.15s',
        fontFamily: 'var(--font-body)',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
    >
      <span style={{
        display: 'inline-block',
        animation: loading ? 'spin 1s linear infinite' : 'none',
        fontSize: 13,
      }}>↻</span>
      {label && <span>{loading ? 'Lade…' : label}</span>}
    </button>
  );
}
