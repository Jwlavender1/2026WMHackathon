export function isPublicPage(route: string) {
  return ['/', '/sign-in', '/sign-up'].includes(route);
}
