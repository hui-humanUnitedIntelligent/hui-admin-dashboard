'use client';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export default function Header({ title, actions }: HeaderProps) {
  return (
    <header
      style={{
        height: 56,
        minHeight: 56,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <h1
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Live-Indikator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 20,
            background: 'var(--green-dim)',
            border: '1px solid rgba(81,207,102,0.25)',
            fontSize: 11,
            color: 'var(--green)',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--green)',
              display: 'inline-block',
              animation: 'pulse 2s infinite',
            }}
          />
          System aktiv
        </div>

        {actions}

        {/* Benachrichtigungs-Button */}
        <button
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 15,
            transition: 'all 0.15s',
          }}
          title="Benachrichtigungen"
        >
          🔔
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </header>
  );
}
