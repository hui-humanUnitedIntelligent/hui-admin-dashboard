// frontend/src/components/dashboard/TableSkeleton.tsx
// ── HUI Admin Dashboard — Einheitlicher Tabellen-Skeleton ────────────────────
'use client';

interface TableSkeletonProps {
  rows?:    number;
  cols?:    number;
  heights?: number[];
}

export default function TableSkeleton({ rows = 5, cols = 6, heights }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri}>
          {Array.from({ length: cols }).map((_, ci) => (
            <td
              key={ci}
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{
                height: heights?.[ci] ?? 11,
                background: 'var(--bg-tertiary)',
                borderRadius: 4,
                animation: 'pulse 2s ease-in-out infinite',
                width: `${40 + (ci * 13) % 45}%`,
              }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Standalone Skeleton für nicht-Tabellen-Layouts */
export function CardSkeleton({ height = 80 }: { height?: number }) {
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: 12,
      height,
      animation: 'pulse 2s ease-in-out infinite',
    }} />
  );
}

/** Grid von CardSkeletons */
export function KPISkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: 12, marginBottom: 18,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} height={90} />
      ))}
    </div>
  );
}
