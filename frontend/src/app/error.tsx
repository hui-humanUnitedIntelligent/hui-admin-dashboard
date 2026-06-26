// frontend/src/app/error.tsx
'use client';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error.name, error.message, error.stack);
  }, [error]);

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', background: 'var(--bg-primary, #0F1117)', minHeight: '100vh' }}>
      <h2 style={{ color: '#ff6b6b', fontSize: 18, marginBottom: 12 }}>
        ⚠️ Seiten-Fehler
      </h2>
      <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 16, marginBottom: 12, fontSize: 13, color: '#ffd43b' }}>
        {error.name}: <span style={{ color: '#ff6b6b' }}>{error.message}</span>
      </div>
      {error.stack && (
        <pre style={{
          background: '#1a1a2e', padding: 16, borderRadius: 8,
          fontSize: 11, overflowX: 'auto', color: '#74c0fc',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 400,
        }}>
          {error.stack}
        </pre>
      )}
      <button onClick={reset} style={{
        marginTop: 12, padding: '8px 20px', background: '#4ECDC4',
        border: 'none', borderRadius: 8, color: '#0F1117', fontWeight: 700, cursor: 'pointer',
      }}>
        Neu laden
      </button>
    </div>
  );
}
