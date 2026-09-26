import type { Metadata } from 'next';
import { configured } from '@/lib/supabase/server';
import { readSnapshot } from './actions';
import { makeFixtures } from '@/lib/fixtures';
import { AppProvider } from '@/components/provider';
import { AppShell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = {
  title: 'Commonly — Do good, together',
  description:
    'Find your next way to help. Community volunteer events, meaningful connections, and all the details in one place.',
};
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = !configured();
  const initial = demo ? makeFixtures() : await readSnapshot();
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
