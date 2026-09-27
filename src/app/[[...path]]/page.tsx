import { AppScreen } from '@/components/screens';
import { notFound, redirect } from 'next/navigation';
import { appMode } from '@/lib/config';
import { auth0 } from '@/lib/auth0';
import { isPublicPage } from '@/lib/access';
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
      '/needs',
      '/sign-in',
      '/sign-up',
      '/onboarding',
    ].includes(route) &&
    !/^\/events\/[^/]+$/.test(route) &&
    !/^\/groups\/[^/]+$/.test(route) &&
    !/^\/event-hub\/[^/]+\/manage$/.test(route)
  )
    notFound();
  if (appMode() === 'live' && !isPublicPage(route) && !(await auth0().getSession())?.user.sub)
    redirect('/');
  return <AppScreen route={route} />;
}
