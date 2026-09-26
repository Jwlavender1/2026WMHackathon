import type { Metadata } from 'next';
import { appMode } from '@/lib/config';
import { readSnapshot } from './actions';
import { emptySnapshot } from '@/lib/types';
import { AppProvider } from '@/components/provider';
import { AppShell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = {
  title: 'Turnout',
  icons: { icon: '/turnout_logo.png', apple: '/turnout_logo.png' },
  description:
    'Find your next way to help. Community volunteer events, meaningful connections, and all the details in one place.',
};
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = appMode() === 'demo';
  const initial = demo ? emptySnapshot() : await readSnapshot();
  return (
    <html lang="en">
      <body>
        <AppProvider initial={initial} demo={demo}>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
