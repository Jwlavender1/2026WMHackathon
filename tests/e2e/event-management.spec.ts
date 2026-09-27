import { test, expect } from '@playwright/test';
import { makeFixtures, fixtureId } from '../../src/lib/fixtures';
import type { DemoState } from '../../src/lib/types';

test.beforeEach(async ({ page }) => {
  const state = makeFixtures();
  state.profile = state.profiles[3];
  await page.addInitScript((value) => {
    if (!localStorage.getItem('commonly-demo-v1'))
      localStorage.setItem('commonly-demo-v1', JSON.stringify(value));
  }, state);
});

test('owner edits one recurring occurrence and can confirm deletion without affecting the series or hours', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/event-hub');
  const original = makeFixtures();
  const initialRow = page.locator('.event-table-row').filter({ hasText: 'Pantry Packing' }).first();
  await initialRow.getByRole('link', { name: 'Edit event', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${fixtureId(20)}/manage#edit-event$`));
  await expect(page.getByRole('heading', { name: 'Edit event', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Repeat', exact: true })).toHaveCount(0);
  await page.getByLabel('Event title', { exact: true }).fill('Pantry Supply Packing');
  await page.getByLabel('Venue', { exact: true }).fill('Community hall');
  await page.getByRole('checkbox', { name: 'Clothing', exact: true }).check();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Pantry Supply Packing', exact: true }),
  ).toBeVisible();
  let saved: DemoState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('commonly-demo-v1')!),
  );
  expect(saved.signups).toEqual(original.signups);
  expect(saved.events.find((event) => event.id === fixtureId(24))?.title).toBe('Pantry Packing');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Pantry Supply Packing', exact: true }),
  ).toBeVisible();
  await page.goto('/event-hub');
  const row = page.locator('.event-table-row').filter({ hasText: 'Pantry Supply Packing' });
  await row.getByRole('button', { name: 'Delete event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete event?' });
  await expect(dialog).toContainText('1 volunteer reservation will be removed');
  await expect(dialog).toContainText('Only this occurrence');
  await expect(dialog.getByRole('button', { name: 'Keep event', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'Keep event', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row.getByRole('button', { name: 'Delete event', exact: true })).toBeFocused();
  await row.getByRole('button', { name: 'Delete event', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await row.getByRole('button', { name: 'Delete event', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/delete-event-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.artifacts/delete-event-mobile.png' });
  await dialog.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.reload();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('commonly-demo-v1')!));
  expect(saved.events.some((event) => event.id === fixtureId(20))).toBe(false);
  expect(saved.events.some((event) => event.id === fixtureId(24))).toBe(true);
  expect(saved.signups.filter((signup) => signup.event_id === fixtureId(20))).toHaveLength(0);
  await page.getByRole('tab', { name: 'Previous events', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete event', exact: true })).toBeDisabled();
  await page.getByLabel('Demo account', { exact: true }).selectOption(fixtureId(1));
  await page.goto('/profile');
  await expect(page.locator('.hours-number')).toHaveText('2.0');
  await page.goto(`/events/${fixtureId(20)}`);
  await expect(page.getByRole('heading', { name: 'Event not found' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('event management fits mobile, supports deletion from Manage, and excludes other organizations', async ({
  page,
}) => {
  await page.goto('/event-hub');
  for (const width of [320, 390, 768, 1024, 1512]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 390 || width === 1512)
      await page.screenshot({ path: `.artifacts/event-hub-actions-${width}.png`, fullPage: true });
  }
  await page.goto(`/event-hub/${fixtureId(23)}/manage`);
  await page.getByRole('button', { name: 'Delete event', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm deletion', exact: true })
    .click();
  await expect(page).toHaveURL(/\/event-hub$/);
  await expect(
    page.getByRole('heading', { name: 'Community Meal Preparation', exact: true }),
  ).toHaveCount(0);
  await page.goto(`/event-hub/${fixtureId(21)}/manage`);
  await expect(page.getByText('You don’t manage this event', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete event', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Event title', { exact: true })).toHaveCount(0);
});
