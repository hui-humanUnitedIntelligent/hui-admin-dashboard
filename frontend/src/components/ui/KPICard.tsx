// frontend/src/components/ui/KPICard.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { KPIVariant, kpiVariantColors } from './system';

export type { KPIVariant };

interface KPICardProps {
  label:         string;
  value:         string | number;
  delta?:        string;
  deltaPositive?: boolean;
  icon:          string;
  /** Farb-Variante aus dem Design-System */
  variant?:      KPIVariant;
  /** @deprecated Nutze variant statt accentColor */
  accentColor?:  string;
  /** @deprecated Nutze variant statt accentDim */
  accentDim?:    string;
  /** Erklärtext, der per Klick auf das Info-Icon angezeigt wird */
  info?:         string;
}

export default function KPICard({
  label,
  value,
  delta,
  deltaPositive = true,
  icon,
  variant = 'teal',
  accentColor,
  accentDim,
  info,
}: KPICardProps) {
  // Rückwärtskompatibel: falls legacy accentColor übergeben wird
  const colors = kpiVariantColors[variant];
  const color  = accentColor ?? colors.color;
  const dim    = accentDim   ?? colors.dim;

  const [showInfo, setShowInfo] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showInfo) return;
    const onClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showInfo]);

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
      position: 'relative',
      overflow: 'visible',
      transition: 'border-color 0.15s',
    }}>
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2, background: color, borderRadius: '12px 12px 0 0',
      }} aria-hidden="true" />

      {/* Icon */}
      <div style={{
        position: 'absolute', right: 14, top: 14,
        width: 32, height: 32, borderRadius: 8,
        background: dim,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }} aria-hidden="true">
        {icon}
      </div>

      {/* Content */}
      <div style={{ paddingRight: 44 }}>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.6px',
          marginBottom: 6, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span>{label}</span>
          {info && (
            <button
              type="button"
              onClick={() => setShowInfo(v => !v)}
              aria-label={`Erklärung zu ${label}`}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '1px solid var(--text-muted)', background: 'transparent',
                color: 'var(--text-muted)', fontSize: 9, lineHeight: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            >
              i
            </button>
          )}
        </div>
        <div style={{
          fontSize: 22, fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.2, marginBottom: 6,
          fontFamily: 'var(--font-mono)',
        }}>
          {value}
        </div>
        {delta !== undefined && (
          <div style={{
            fontSize: 11, fontWeight: 500,
            color: deltaPositive ? 'var(--green)' : 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <span aria-hidden="true">{deltaPositive ? '▲' : '▼'}</span>
            <span>{delta}</span>
          </div>
        )}
      </div>

      {/* Info-Popover */}
      {info && showInfo && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6,
            zIndex: 20, width: 240, maxWidth: '80vw',
            background: 'var(--bg-primary, var(--bg-secondary))',
            border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            padding: '10px 12px', fontSize: 12, lineHeight: 1.45,
            color: 'var(--text-primary)',
          }}
        >
          {info}
        </div>
      )}
    </div>
  );
}
