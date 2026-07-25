// frontend/src/components/ui/DataTable.tsx
// ── HUI Admin Dashboard — Einheitliche Tabellen-Komponente ───────────────────
// Desktop: klassische Tabelle | Mobile (≤768px): Card-List-Modus
'use client';

import React from 'react';

export interface DataTableColumn<T> {
  key:          string;
  header:       string;
  width?:       number | string;
  align?:       'left' | 'center' | 'right';
  render?:      (row: T, i: number) => React.ReactNode;
  hideOnMobile?: boolean;   // Spalte auf Mobile komplett ausblenden
  isAction?:    boolean;    // Aktions-Spalte → im Card-Modus ans Ende
  isPrimary?:   boolean;    // Haupt-Info → im Card-Modus als Header
}

interface DataTableProps<T> {
  columns:       DataTableColumn<T>[];
  data:          T[];
  keyField?:     string;
  loading?:      boolean;
  emptyText?:    string;
  onRowClick?:   (row: T) => void;
  stickyHeader?: boolean;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField     = 'id',
  loading      = false,
  emptyText    = 'Keine Einträge',
  onRowClick,
  stickyHeader = true,
}: DataTableProps<T>) {

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>⟳</div>
        <div>Laden…</div>
      </div>
    );
  }

  const primaryCol  = columns.find(c => c.isPrimary);
  const actionCols  = columns.filter(c => c.isAction);
  const dataCols    = columns.filter(c => !c.isAction && !c.isPrimary && !c.hideOnMobile);

  return (
    <>
      {/* ── DESKTOP TABLE ── */}
      <div className="mobile-card-table" style={{ overflowX: 'auto', width: '100%' }}>
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
                  className={onRowClick ? 'tr-hover' : ''}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: onRowClick ? 'pointer' : undefined,
                  }}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      style={{
                        padding: '10px 14px',
                        textAlign: col.align ?? 'left',
                        color: 'var(--text-primary)',
                        verticalAlign: 'middle',
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.render ? col.render(row, i) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE CARD LIST ── */}
      <div className="mobile-card-list">
        {data.length === 0 ? (
          <div style={{
            padding: '32px 16px', textAlign: 'center',
            color: 'var(--text-muted)', fontSize: 13,
            background: 'var(--bg-secondary)', borderRadius: 12,
            border: '1px solid var(--border)',
          }}>
            {emptyText}
          </div>
        ) : (
          data.map((row, i) => (
            <div
              key={String(row[keyField] ?? i)}
              className="m-card card-hover"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? 'pointer' : undefined }}
            >
              {/* Primary field als Karten-Header */}
              {primaryCol && (
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: 'var(--text-primary)',
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--border)',
                }}>
                  {primaryCol.render ? primaryCol.render(row, i) : String(row[primaryCol.key] ?? '—')}
                </div>
              )}

              {/* Datenspalten als Label+Wert Paare */}
              {dataCols.map(col => {
                const val = col.render ? col.render(row, i) : String(row[col.key] ?? '');
                const strVal = typeof val === 'string' ? val : '';
                if (strVal === '' && !col.render) return null;
                return (
                  <div key={col.key} className="m-card-row">
                    <span className="m-card-label">{col.header}</span>
                    <span className="m-card-value">{val}</span>
                  </div>
                );
              })}

              {/* Aktions-Buttons am Ende */}
              {actionCols.length > 0 && (
                <div className="m-card-actions">
                  {actionCols.map(col => (
                    <div key={col.key} style={{ display: 'contents' }}>
                      {col.render ? col.render(row, i) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
