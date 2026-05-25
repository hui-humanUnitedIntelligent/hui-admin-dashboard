import type { Metadata } from 'next';
import '../styles/globals.css';
import AuthGuard from './AuthGuard';

export const metadata: Metadata = {
    title: 'HUI Admin',
    description: 'HUI Platform Administration',
    robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
          <html lang="de">
                <head>
                        <meta name="robots" content="noindex, nofollow" />
                        <meta name="referrer" content="no-referrer" />
                </head>head>
                <body>
                        <AuthGuard>{children}</AuthGuard>AuthGuard>
                </body>body>
          </html>html>
        );
}</html>
