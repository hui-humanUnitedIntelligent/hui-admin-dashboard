// frontend/src/components/ui/DataTable.tsx
// ── HUI Admin Dashboard — Einheitliche Tabellen-Komponente ───────────────────
// Kann von allen Pages als Alternative zur nativen <table> genutzt werden.
'use client';

import React from 'react';

export interface DataTableColumn<T> {
  key:       string;
  header:    string;
  width?:    number | string;
  align?:    'left' | 'center' | 'right';
  render?:   (row: T, i: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns:    DataTableColumn<T>[];
  data:       T[];
  keyField?:  string;
  loading?:   boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField    = 'id',
  loading     = false,
  emptyText   = 'Keine Einträge',
  onRowClick,
  stickyHeader = true,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        <span style={{ fontSize: 20 }}>⟳</span>
        <div style={{ marginTop: 8 }}>Laden…</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table
        role="grid"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12.5,
          fontFamily: 'var(--font-body)',
        }}
      >
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                scope="col"
                style={{
                  padding: '10px 14px',
                  textAlign: col.align ?? 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  whiteSpace: 'nowrap',
                  position: stickyHeader ? 'sticky' : undefined,
                  top: stickyHeader ? 0 : undefined,
                  zIndex: stickyHeader ? 1 : undefined,
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={String(row[keyField] ?? i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onKeyDown={onRowClick
                  ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(row); }
                  : undefined}
                style={{
                  borderBottom: '1px solid var(--border)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (onRowClick) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    style={{
                      padding: '10px 14px',
                      color: 'var(--text-secondary)',
                      textAlign: col.align ?? 'left',
                      verticalAlign: 'middle',
                    }}
                  >
                    {col.render
                      ? col.render(row, i)
                      : String(row[col.key] ?? '—')
                    }
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
