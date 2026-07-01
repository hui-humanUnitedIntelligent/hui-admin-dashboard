// frontend/src/app/analytics/page.tsx
// ARCH-006.1 -- VOLLSTAENDIG in das Hauptdashboard integriert.
// Die letzten 3 verbliebenen, einzigartigen Karten (User-Zusammensetzung,
// Top-Staedte, Mitgliedschafts-Typen) leben jetzt live im Hauptdashboard
// (/dashboard, Abschnitt "Analytics" -> 8 Kuchendiagramme). Diese Seite
// existiert nur noch als Redirect, damit alte Links/Lesezeichen nicht ins
// Leere laufen -- kein eigener Inhalt mehr, keine doppelten Karten, keine
// zweite Wahrheit.
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalyticsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return null;
}
