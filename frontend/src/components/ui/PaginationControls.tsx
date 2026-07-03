// frontend/src/components/ui/PaginationControls.tsx
// ── Gemeinsame Seiten-Navigation für alle Admin-Listen (fix 20 pro Seite) ───────
'use client';

interface PaginationControlsProps {
  visibleCount: number;  // Anzahl auf der aktuellen Seite
  total:        number;  // Gesamtzahl über alle Seiten
  page:         number;
  totalPages:   number;
  onGoToPage:   (p: number) => void;
}

export default function PaginationControls({
  visibleCount, total, page, totalPages, onGoToPage,
}: PaginationControlsProps) {
  if (total === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {visibleCount} von {total} gesamt
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => onGoToPage(page - 1)}
            disabled={page <= 1}
            style={{
              padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)', color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              fontSize: 12, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1,
            }}
          >‹</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            // Bei vielen Seiten: aktuelle ± 2 zeigen, Rest andeuten
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | 'gap')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('gap');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) => p === 'gap' ? (
              <span key={`gap-${i}`} style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 2px' }}>…</span>
            ) : (
              <button
                key={p}
                onClick={() => onGoToPage(p)}
                style={{
                  padding: '5px 11px', borderRadius: 8,
                  border: `1px solid ${p === page ? 'var(--accent)' : 'var(--border)'}`,
                  background: p === page ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: p === page ? '#0f1117' : 'var(--text-primary)',
                  fontSize: 12, fontWeight: p === page ? 700 : 500, cursor: 'pointer',
                }}
              >{p}</button>
            ))}

          <button
            onClick={() => onGoToPage(page + 1)}
            disabled={page >= totalPages}
            style={{
              padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)', color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              fontSize: 12, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1,
            }}
          >›</button>
        </div>
      )}
    </div>
  );
}
