'use client';

import { useState, useEffect } from 'react';

export default function PushNotificationManager() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if push is supported
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true);
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  async function checkExistingSubscription() {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) setSubscribed(true);
    } catch (err) {
      console.error('[PushManager] checkExistingSubscription error:', err);
    }
  }

  async function handleEnable() {
    setLoading(true);
    try {
      // Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setLoading(false);
        return;
      }

      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/',
      });

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Get VAPID public key
      const res = await fetch('/api/push/public-key');
      const { publicKey } = await res.json();

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      // Send subscription to server
      const subJSON = sub.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: subJSON.keys,
          userEmail: 'admin@hui.app',
        }),
      });

      setSubscribed(true);
    } catch (err) {
      console.error('[PushManager] subscribe error:', err);
      alert('Push-Benachrichtigungen konnten nicht aktiviert werden. Fehler: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
      }
      setSubscribed(false);
    } catch (err) {
      console.error('[PushManager] unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) {
    return (
      <div style={{ padding: '16px 0', opacity: 0.6 }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
          Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.
        </p>
      </div>
    );
  }

  if (subscribed) {
    return (
      <div style={{ padding: '8px 0' }}>
        <button
          onClick={handleDisable}
          disabled={loading}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            background: 'var(--surface-2, #1a1a1a)',
            color: 'var(--text-primary, #e0e0e0)',
            border: '1px solid var(--border, #333)',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          {loading ? '...' : '✓ Benachrichtigungen aktiv — Klick zum Deaktivieren'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <button
        onClick={handleEnable}
        disabled={loading || permission === 'denied'}
        style={{
          padding: '8px 16px',
          fontSize: '0.85rem',
          background: permission === 'denied' ? 'var(--surface-2, #1a1a1a)' : 'var(--accent, #f5a623)',
          color: permission === 'denied' ? 'var(--text-muted, #888)' : '#000',
          border: '1px solid var(--border, #333)',
          borderRadius: '8px',
          cursor: permission === 'denied' ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        {loading ? 'Aktiviere...' : permission === 'denied' ? 'Blockiert (Browser-Settings)' : '🔔 Push-Benachrichtigungen aktivieren'}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
