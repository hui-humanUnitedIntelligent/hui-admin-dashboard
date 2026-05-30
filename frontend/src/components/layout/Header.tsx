// frontend/src/components/layout/Header.tsx
'use client';

import { useEffect, useState } from 'react';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
  onMenuToggle?: () => void;
}

export default function Header({ title, actions, onMenuToggle }: HeaderProps) {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString('de-DE', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      style={{
        height: 52,
        minHeight: 52,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px 0 20px',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Burger Menu (mobile) */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          style={{
            display: 'none',
            background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-secondary)',
            fontSize: 18, padding: '4px 6px', lineHeight: 1,
            borderRadius: 6,
          }}
          className="show-mobile"
          aria-label="Menu"
        >
          ☰
        </button>
      )}

      <h1
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          margin: 0,
          letterSpacing: '-0.2px',
        }}
      >
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Live Clock */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            background: 'var(--bg-tertiary)',
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}
        >
          <span className="live-dot" />
          <span
            style={{
              fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.3px',
            }}
          >
            {time || '--:--:--'}
          </span>
        </div>

        {/* Custom actions */}
        {actions}
      </div>
    </header>
  );
}
