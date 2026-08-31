// frontend/src/components/website/StatusCard.tsx
// Wiederverwendbare Status-Karte für die HUI Website-Sektion
'use client';

import React from 'react';

export type StatusLevel = 'ok' | 'warning' | 'error' | 'unknown';

export const STATUS_CONFIG: Record<StatusLevel, { color: string; bg: string; emoji: string; label: string }> = {
  ok:      { color: 'var(--green)', bg: 'rgba(81,207,102,0.08)',  emoji: '🟢', label: 'OK' },
  warning: { color: 'var(--gold)',  bg: 'rgba(247,183,49,0.08)',  emoji: '🟡', label: 'Achtung' },
  error:   { color: 'var(--red)',   bg: 'rgba(255,107,107,0.08)', emoji: '🔴', label: 'Problem' },
  unknown: { color: 'var(--text-muted)', bg: 'var(--bg-tertiary)', emoji: '⚪', label: 'Unbekannt' },
};

interface StatusCardProps {
  title: string;
  items: { label: string; value: string; status: StatusLevel }[];
  loading?: boolean;
}

export function StatusCard({ title, items, loading }: StatusCardProps) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 18,
    }}>
      <h3 style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: 14,
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
      }}>{title}</h3>

      {loading ? (
        <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Wird geprüft…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, i) => {
            const cfg = STATUS_CONFIG[item.status];
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 0',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 10, lineHeight: 1, flexShrink: 0 }}>{cfg.emoji}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: cfg.color,
                  background: cfg.bg,
                  padding: '3px 10px',
                  borderRadius: 6,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}>
                  {item.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Compact status pill
export function StatusPill({ status, label }: { status: StatusLevel; label?: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      fontWeight: 500,
      color: cfg.color,
      background: cfg.bg,
      padding: '3px 10px',
      borderRadius: 6,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 9 }}>{cfg.emoji}</span>
      {label ?? cfg.label}
    </span>
  );
}

// Health score ring
export function HealthScore({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score === 100 ? 'var(--green)' : score >= 70 ? 'var(--gold)' : 'var(--red)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth={5} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight={700} fill={color}>
          {score}%
        </text>
      </svg>
    </div>
  );
}

// Connection card for the Verknüpfungen page
export function ConnectionCard({
  name,
  icon,
  status,
  description,
  actionLabel,
  actionHref,
  external,
}: {
  name: string;
  icon: string;
  status: StatusLevel;
  description: string;
  actionLabel: string;
  actionHref: string;
  external?: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'var(--bg-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {description}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <StatusPill status={status} />
        <a
          href={actionHref}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: status === 'ok' ? 'var(--accent)' : 'var(--gold)',
            textDecoration: 'none',
            padding: '6px 14px',
            border: `1px solid ${status === 'ok' ? 'var(--accent)' : 'var(--gold)'}`,
            borderRadius: 7,
            whiteSpace: 'nowrap',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = status === 'ok' ? 'var(--accent-dim)' : 'var(--gold-dim)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {actionLabel}
        </a>
      </div>
    </div>
  );
}
