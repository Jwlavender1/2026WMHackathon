import { test, expect } from '@playwright/test';
import { makeFixtures, fixtureId } from '../../src/lib/fixtures';
import { DEMO_LOCATIONS } from '../../src/lib/location';

test('signed-out landing replaces private navigation and app pages', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Community service, organized.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0);
  await expect(page.locator('.event-card')).toHaveCount(0);
  await expect(page.getByText('EXAMPLE', { exact: true })).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/landing-desktop.png', fullPage: true });
  for (const route of [
    '/browse',
    `/events/${fixtureId(100)}`,
    '/community',
    '/profile',
    '/onboarding',
    '/messages',
    '/my-group',
    '/event-hub/new',
    '/groups/williamsburg-regional-library',
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: 'Community service, organized.' }),
    ).toBeVisible();
    await expect(page.locator('.event-card')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('landing sign-in opens the app and sign-out restores the landing page', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Welcome navigation' })
    .getByRole('link', { name: 'Sign in' })
    .click();
  await expect(page.getByRole('heading', { name: 'Welcome back', level: 1 })).toBeVisible();
  await expect(page.locator('.auth-intro')).toHaveCount(0);
  const panel = (await page.locator('.auth-panel').boundingBox())!;
  expect(Math.abs(panel.x + panel.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/sign-in-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/browse$/);
  await expect(page.getByLabel('Location', { exact: true })).toHaveValue('Williamsburg, VA');
  await expect(page.locator('.event-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Community service, organized.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Community service, organized.' })).toBeVisible();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Landing Volunteer');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'How will you use Turnout?' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('discovery distinguishes cities in different states and lets volunteers search elsewhere', async ({
  page,
}) => {
  const state = makeFixtures();
  state.profile!.location = DEMO_LOCATIONS[1];
  await page.addInitScript((data) => {
    localStorage.setItem('commonly-demo-v1', JSON.stringify(data));
  }, state);
  await page.goto('/browse');
  await expect(page.getByLabel('Location', { exact: true })).toHaveValue('Williamsburg, KY');
  await expect(page.locator('.event-card')).toHaveCount(0);
  await expect(page.getByText('No opportunities found', { exact: true })).toBeVisible();
  await page.getByLabel('Location', { exact: true }).fill('Williamsburg, VA');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(page.locator('.event-card')).toHaveCount(5);
  await page.getByLabel('Location', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(page.getByText('Showing all locations.', { exact: true })).toBeVisible();
  await expect(page.locator('.event-card')).toHaveCount(5);
  await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByLabel('Location', { exact: true })).toHaveValue('Williamsburg, KY');
  await expect(page.locator('.event-card')).toHaveCount(0);
});

test('legacy profiles must confirm a city before local discovery', async ({ page }) => {
  const state = makeFixtures();
  state.profile!.location = null;
  await page.addInitScript((data) => {
    localStorage.setItem('commonly-demo-v1', JSON.stringify(data));
  }, state);
  await page.goto('/browse');
  await expect(page.getByText(/Confirm your city in/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'your profile', exact: true })).toHaveAttribute(
    'href',
    '/profile',
  );
  await expect(page.locator('.event-card')).toHaveCount(0);
});

test('landing fits mobile and tablet widths with working account links', async ({ page }) => {
  await page.goto('/');
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.getByRole('heading', { name: 'Community service, organized.' }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 390)
      await page.screenshot({ path: '.artifacts/landing-mobile.png', fullPage: true });
  }
  await page.getByRole('link', { name: 'Set up your organization' }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Create your account', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('main').getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back', level: 1 })).toBeVisible();
  await page.screenshot({ path: '.artifacts/sign-in-mobile.png', fullPage: true });
});
