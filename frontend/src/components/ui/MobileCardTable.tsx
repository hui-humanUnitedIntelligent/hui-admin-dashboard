// frontend/src/components/ui/MobileCardTable.tsx
// ── Wrapper: Desktop = normale Table, Mobile = Card-Stack ────────────────────
// Verwendung: <MobileCardTable headers={[...]} rows={[...]} onRowClick={...} />
'use client';

import React from 'react';

export interface MobileCardRow {
  id:       string | number;
  cells:    React.ReactNode[];
  /** Welche Zell-Indices als Aktions-Bereich behandeln (am Ende der Karte) */
  actionIndices?: number[];
  onClick?: () => void;
}

interface MobileCardTableProps {
  headers:      string[];
  rows:         MobileCardRow[];
  loading?:     boolean;
  emptyText?:   string;
  /** Index der Haupt-Spalte (fett oben in der Karte) */
  primaryIndex?: number;
  /** Welche Spalten auf Mobile ausblenden */
  hiddenOnMobile?: number[];
}

export default function MobileCardTable({
  headers,
  rows,
  loading      = false,
  emptyText    = 'Keine Einträge',
  primaryIndex  = 0,
  hiddenOnMobile = [],
}: MobileCardTableProps) {
  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>⟳</div>
        <div>Laden…</div>
      </div>
    );
  }

  return (
    <>
      {/* ── DESKTOP TABLE ── */}
      <div className="mobile-card-table" style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '10px 14px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600,
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  whiteSpace: 'nowrap',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} style={{
                  padding: '40px 20px', textAlign: 'center',
                  color: 'var(--text-muted)', fontSize: 13,
                }}>
                  {emptyText}
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id}
                className={row.onClick ? 'tr-hover' : ''}
                onClick={row.onClick}
                style={{ borderBottom: '1px solid var(--border)', cursor: row.onClick ? 'pointer' : undefined }}
              >
                {row.cells.map((cell, ci) => (
                  <td key={ci} style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE CARD LIST ── */}
      <div className="mobile-card-list">
        {rows.length === 0 ? (
          <div style={{
            padding: '32px 16px', textAlign: 'center',
            color: 'var(--text-muted)', fontSize: 13,
            background: 'var(--bg-secondary)', borderRadius: 12,
            border: '1px solid var(--border)',
          }}>
            {emptyText}
          </div>
        ) : rows.map((row) => {
          const actionIdx = row.actionIndices ?? [headers.length - 1];
          const dataIdx   = headers
            .map((_, i) => i)
            .filter(i => i !== primaryIndex && !actionIdx.includes(i) && !hiddenOnMobile.includes(i));

          return (
            <div key={row.id} className="m-card card-hover"
              onClick={row.onClick}
              style={{ cursor: row.onClick ? 'pointer' : undefined }}
            >
              {/* Primary Cell */}
              <div style={{
                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                paddingBottom: 8, borderBottom: '1px solid var(--border)',
              }}>
                {row.cells[primaryIndex]}
              </div>

              {/* Data Cells */}
              {dataIdx.map(i => (
                <div key={i} className="m-card-row">
                  <span className="m-card-label">{headers[i]}</span>
                  <span className="m-card-value">{row.cells[i]}</span>
                </div>
              ))}

              {/* Action Cells */}
              {actionIdx.some(i => row.cells[i]) && (
                <div className="m-card-actions" onClick={e => e.stopPropagation()}>
                  {actionIdx.map(i => (
                    <div key={i} style={{ display: 'contents' }}>
                      {row.cells[i]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
