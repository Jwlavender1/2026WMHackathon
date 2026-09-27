import { test, expect } from '@playwright/test';
import { makeFixtures, fixtureId } from '../../src/lib/fixtures';
import type { DemoState } from '../../src/lib/types';

const storageKey = 'commonly-demo-v1';

test('volunteer can cancel or escape deletion, then confirm and stay signed out after reload', async ({
  page,
}) => {
  const state = makeFixtures();
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: state },
  );
  await page.goto('/profile');
  const trigger = page.getByRole('button', { name: 'Delete account', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Delete account?' });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Permanently delete account' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Maya King');
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/delete-volunteer-mobile.png', fullPage: true });
  await dialog.getByLabel('Type DELETE to confirm').fill('delete');
  await expect(dialog.getByRole('button', { name: 'Permanently delete account' })).toBeDisabled();
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
  await dialog.getByRole('button', { name: 'Permanently delete account' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Community service, organized.' })).toBeVisible();
  await page.reload();
  const saved: DemoState = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
  expect(saved.profile).toBeNull();
  expect(saved.profiles.some((p) => p.id === fixtureId(1))).toBe(false);
  expect(saved.signups.some((s) => s.volunteer_id === fixtureId(1))).toBe(false);
  expect(saved.tasks.find((t) => t.id === fixtureId(200))?.reserved).toBe(0);
  expect(saved.groups).toEqual(state.groups);
});

test('organization deletion archives its group, cancels events, and keeps volunteer history', async ({
  page,
}) => {
  const state = makeFixtures();
  state.profile = state.profiles[3];
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: state },
  );
  await page.goto('/my-group');
  await page.getByRole('button', { name: 'Delete organization account', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete organization account?' });
  await expect(dialog).toContainText('verified hours will remain');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/delete-organization-desktop.png', fullPage: true });
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
  await dialog.getByRole('button', { name: 'Permanently delete account' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/browse$/);
  await expect(page.locator('.event-card')).toHaveCount(2);
  await expect(
    page
      .getByLabel('Organizing group')
      .getByRole('option', { name: 'Williamsburg House of Mercy' }),
  ).toHaveCount(0);
  await page.goto('/community');
  await expect(
    page.getByRole('heading', { name: 'Williamsburg House of Mercy', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Williamsburg Regional Library', exact: true }),
  ).toBeVisible();
  await page.goto('/profile');
  await expect(page.locator('.hours-number')).toHaveText('2.0');
  await expect(page.locator('.service-history')).toContainText('Neighbors Helping Neighbors');
  await page.goto('/groups/williamsburg-house-of-mercy');
  await expect(page.getByRole('heading', { name: 'Archived organization' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact organization' })).toHaveCount(0);
});
