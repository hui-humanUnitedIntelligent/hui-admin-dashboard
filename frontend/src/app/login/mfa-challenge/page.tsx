// frontend/src/app/login/mfa-challenge/page.tsx
// Normale 2FA-Abfrage für Nutzer die bereits einen TOTP-Faktor eingerichtet haben.
'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ChallengeForm() {
  const searchParams = useSearchParams();
  const factorId = searchParams.get('factorId') || '';

  const [code, setCode]             = useState('');
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, code }),
      });
      const d = await res.json();
      if (!d.ok) { setError(d.error || 'Ungültiger Code.'); setSubmitting(false); return; }
      window.location.replace(d.redirect || '/dashboard');
    } catch {
      setError('Verbindungsfehler.');
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 16, letterSpacing: 4, textAlign: 'center',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            🔐 Zwei-Faktor-Code
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Öffne deine Authenticator-App und gib den aktuellen Code ein.
          </div>
        </div>

        {!factorId && (
          <div style={{
            padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
            fontSize: 13, color: '#f87171', textAlign: 'center', marginBottom: 16,
          }}>
            ⚠️ Sitzung unvollständig. <a href="/login" style={{ color: 'var(--accent)' }}>Zurück zum Login</a>
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            style={inputStyle} placeholder="000000" autoFocus disabled={!factorId}
          />

          {error && (
            <div style={{
              padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              fontSize: 13, color: '#f87171',
            }}>⚠️ {error}</div>
          )}

          <button
            type="submit" disabled={submitting || code.length !== 6 || !factorId}
            style={{
              padding: '12px', background: 'var(--accent)', color: '#0F1117',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
              cursor: submitting || code.length !== 6 || !factorId ? 'not-allowed' : 'pointer',
              opacity: submitting || code.length !== 6 || !factorId ? 0.6 : 1,
            }}
          >
            {submitting ? 'Wird geprüft…' : 'Bestätigen'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />}>
      <ChallengeForm />
    </Suspense>
  );
}
