// frontend/src/components/ui/KPICard.tsx
'use client';

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
}: KPICardProps) {
  // Rückwärtskompatibel: falls legacy accentColor übergeben wird
  const colors = kpiVariantColors[variant];
  const color  = accentColor ?? colors.color;
  const dim    = accentDim   ?? colors.dim;

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2, background: color,
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
        }}>
          {label}
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
    </div>
  );
}
