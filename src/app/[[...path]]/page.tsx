import { AppScreen } from '@/components/screens';
import { notFound } from 'next/navigation';
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const route = '/' + path.join('/');
  if (
    ![
      '/',
      '/browse',
      '/events',
      '/profile',
      '/my-group',
      '/event-hub',
      '/event-hub/new',
      '/messages',
      '/community',
      '/sign-in',
      '/sign-up',
    ].includes(route) &&
    !/^\/events\/[^/]+$/.test(route) &&
    !/^\/groups\/[^/]+$/.test(route) &&
    !/^\/event-hub\/[^/]+\/manage$/.test(route)
  )
    notFound();
  return <AppScreen route={route} />;
}
