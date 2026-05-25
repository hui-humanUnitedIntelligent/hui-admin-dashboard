'use client';

interface KPICardProps {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  icon: string;
  accentColor: string;
  accentDim: string;
}

export default function KPICard({
  label,
  value,
  delta,
  deltaPositive,
  icon,
  accentColor,
  accentDim,
}: KPICardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: accentColor,
        }}
      />

      {/* Icon */}
      <div
        style={{
          position: 'absolute',
          right: 14,
          top: 14,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: accentDim,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          color: accentColor,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.5px',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          marginBottom: 8,
          marginTop: 4,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontFamily: 'Space Mono, monospace',
          letterSpacing: '-1px',
          marginBottom: 6,
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 11,
          color: deltaPositive ? 'var(--green)' : 'var(--red)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {deltaPositive ? '↑' : '↓'} {delta} vs. Vormonat
      </div>
    </div>
  );
}
