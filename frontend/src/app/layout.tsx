// frontend/src/app/layout.tsx
import type { Metadata } from 'next';
import '../styles/globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'HUI Admin',
  description: 'HUI Platform Administration',
  robots: { index: false, follow: false },
};

const SW_REGISTER = [
  "if ('serviceWorker' in navigator) {",
  "  window.addEventListener('load', function() {",
  "    navigator.serviceWorker.register('/sw-push.js', { scope: '/' })",
  "      .catch(function(err) { console.error('[SW] Registration failed:', err); });",
  "  });",
  "}"
].join('\n');

const THEME_INIT = `
  (function(){
    try {
      var t = localStorage.getItem('hui_admin_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', t);
    } catch(e){}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HUI Admin" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER }} />
      </body>
    </html>
  );
}
