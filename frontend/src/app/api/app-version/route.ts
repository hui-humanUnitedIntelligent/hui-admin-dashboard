import { NextResponse } from 'next/server';

/**
 * OTA Version Check Endpoint
 * Called by the Android WebView app on startup to check if a new APK is available.
 * Returns current latest APK version info + download URL.
 */
export async function GET() {
  return NextResponse.json({
    versionCode: 3,
    versionName: '1.2',
    downloadUrl: 'https://github.com/hui-humanUnitedIntelligent/hui-admin-dashboard/releases/download/v1.2-apk/HUI-Admin-v1.2.apk',
    message: 'v1.2 — Fix: Header/Burger-Menü war hinter der Statusleiste versteckt. Jetzt sichtbar (Werke, Talente, Erlebnisse, Momente, Impact-Projekte etc. anklickbar).',
  }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
