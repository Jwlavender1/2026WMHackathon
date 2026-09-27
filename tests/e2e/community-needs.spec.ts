import { expect, test } from '@playwright/test';

test('community needs map shows totals, gap insights, filters, and a table view', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/browse$/);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Needs map' })
    .click();
  await expect(page).toHaveURL(/\/needs$/);
  await expect(
    page.getByRole('heading', { name: 'Where help is needed.', level: 1 }),
  ).toBeVisible();
  const tiles = page.getByRole('region', { name: 'Summary for the next 30 days' });
  await expect(tiles).toContainText('5Upcoming events');
  // Demo volunteers chose Environment but no Environment events exist: the top gap.
  const insights = page.locator('.needs-insight');
  await expect(insights.first()).toContainText('Environment');
  await expect(insights.first()).toContainText('no upcoming events');
  await expect(page.locator('.needs-transparency')).toContainText('fixed rules');
  await expect(page.locator('.needs-pin')).toHaveCount(4);
  await page
    .getByRole('group', { name: 'Filter by cause' })
    .getByRole('button', { name: 'Education' })
    .click();
  await expect(page.locator('.needs-pin')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Upcoming events · Education' })).toBeVisible();
  await page.getByText('View as table').click();
  await expect(page.getByRole('row', { name: /Food access fewer than 3 3 31 32/ })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/needs-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.artifacts/needs-mobile.png', fullPage: true });
});
