// frontend/src/app/global-error.tsx
// Zeigt echten Stack-Trace statt generischem Next.js-Fehler
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, background: '#0F1117', color: '#f87171', fontFamily: 'monospace', padding: 24 }}>
        <div style={{ maxWidth: 900 }}>
          <h2 style={{ color: '#ff6b6b', fontSize: 18, marginBottom: 12 }}>
            ⚠️ Application Error
          </h2>
          <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 13 }}>
            <strong style={{ color: '#ffd43b' }}>{error.name}:</strong>{' '}
            <span style={{ color: '#ff6b6b' }}>{error.message}</span>
            {error.digest && (
              <div style={{ color: '#868e96', marginTop: 4, fontSize: 11 }}>
                Digest: {error.digest}
              </div>
            )}
          </div>
          {error.stack && (
            <pre style={{
              background: '#1a1a2e', borderRadius: 8, padding: 16,
              fontSize: 11, overflowX: 'auto', color: '#74c0fc',
              border: '1px solid #2d3748', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {error.stack}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16, padding: '8px 20px', background: '#4ECDC4',
              border: 'none', borderRadius: 8, color: '#0F1117',
              fontWeight: 700, cursor: 'pointer', fontSize: 14,
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
