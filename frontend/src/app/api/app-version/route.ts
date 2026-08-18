import { NextResponse } from 'next/server';

/**
 * OTA Version Check Endpoint
 * Called by the Android WebView app on startup to check if a new APK is available.
 * Returns current latest APK version info + download URL.
 */
export async function GET() {
  return NextResponse.json({
    versionCode: 2,
    versionName: '1.1',
    downloadUrl: 'https://base44.app/api/apps/6a840e4b298bd7a7f6f8a640/files/mp/public/6a840e4b298bd7a7f6f8a640/8263dacbd_HUI-Admin-v11.zip',
    message: 'v1.1 — Mobile-Optimierung: bessere Tabellen & Karten auf dem Handy, Auto-Reload nach 5 Min.',
  }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
