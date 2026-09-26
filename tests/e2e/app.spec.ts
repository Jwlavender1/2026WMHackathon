import { test, expect } from '@playwright/test';
import { fixtureId } from '../../src/lib/fixtures';
import { mkdir } from 'node:fs/promises';

test('about page, filtering, reservations, messages, and profile persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Service events in your community' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'About', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: 'Upcoming opportunities' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Community service in your area' })).toBeVisible();
  await mkdir('.artifacts', { recursive: true });
  await page.evaluate(() =>
    Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {}))),
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/home-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Discover', exact: true }).click();
  await page.getByLabel('Location', { exact: true }).fill('Williamsburg');
  await page.getByLabel('Organizing group').selectOption(fixtureId(11));
  await page.getByLabel('Task', { exact: true }).fill('sort books');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(page.locator('.event-card')).toHaveCount(1);
  await page.getByRole('heading', { name: 'Book Donation Sorting', exact: true }).click();
  await page.getByRole('button', { name: 'Join', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'You’re on the list!' })).toBeVisible();
  await page
    .getByLabel('Your message')
    .fill('Looking forward to helping. See you at the sorting room!');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.comments')).toContainText('Looking forward to helping.');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'You’re on the list!' })).toBeVisible();
  await expect(page.locator('.comments')).toContainText('Looking forward to helping.');
  await page.goto('/profile');
  await page
    .getByRole('textbox', { name: 'About me', exact: true })
    .fill('I love helping my Williamsburg community.');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toContainText('Profile saved');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'About me', exact: true })).toHaveValue(
    'I love helping my Williamsburg community.',
  );
  await page.getByLabel('Profile picture').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk0sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByRole('status')).toContainText('Profile picture updated');
  await page.reload();
  await expect(page.locator('.avatar.large img')).toHaveAttribute('src', /^data:image\/png/);
  expect(errors).toEqual([]);
});

test('new organization onboarding, group setup, occurrence editing, and cancellation', async ({
  page,
}) => {
  await page.goto('/sign-up');
  await page.getByRole('button', { name: 'Organization', exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Community Coordinator');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('link', { name: 'My group', exact: true }).click();
  await page.getByLabel('Organization name').fill('Neighborhood Helpers');
  await page
    .getByRole('textbox', { name: 'About your organization' })
    .fill('Neighbors working together to make Williamsburg a more welcoming place.');
  await page.getByRole('button', { name: 'Create group', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Event hub', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Create event', exact: true }).last().click();
  await page.getByLabel('Event title', { exact: true }).fill('Neighborhood Welcome Day');
  await page
    .getByRole('textbox', { name: 'Description', exact: true })
    .fill('Help welcome new neighbors with a friendly community gathering.');
  await page.getByLabel('Venue', { exact: true }).fill('Community room');
  await page.getByLabel('Address / meeting point').fill('Demo community room entrance');
  await page.getByRole('button', { name: 'Publish event' }).click();
  await page.getByRole('link', { name: 'Manage', exact: true }).click();
  await page.getByLabel('Event title', { exact: true }).fill('Neighborhood Welcome Afternoon');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Neighborhood Welcome Afternoon', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Manage this event' }).click();
  await page.getByRole('button', { name: 'Cancel event', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await page.getByRole('link', { name: 'View event', exact: true }).click();
  await expect(page.getByText('This event has been cancelled.', { exact: true })).toBeVisible();
});

test('organization creates recurring events and verifies attendance', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Demo account', { exact: true }).selectOption(fixtureId(4));
  await page.getByRole('link', { name: 'Event hub', exact: true }).click();
  await page.getByRole('link', { name: 'Create event', exact: true }).last().click();
  await page.getByLabel('Event title', { exact: true }).fill('Saturday Community Care');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Pack supplies and meet neighbors at the community center.');
  await page.getByLabel('Venue', { exact: true }).fill('Community center');
  await page.getByLabel('Address / meeting point').fill('Demo community center entrance');
  await page.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('1');
  await page.getByLabel('Number of occurrences').fill('3');
  await page.getByRole('button', { name: 'Publish event' }).click();
  await expect(page).toHaveURL(/\/event-hub$/);
  await expect(
    page.getByRole('heading', { name: 'Saturday Community Care', exact: true }),
  ).toHaveCount(3);
  await page.getByRole('tab', { name: 'Previous events' }).click();
  await page.getByRole('link', { name: 'Record attendance' }).click();
  await page.getByRole('spinbutton', { name: 'Minutes served by Maya King' }).fill('60');
  await page
    .locator('.attendee-row')
    .filter({ hasText: 'Maya King' })
    .getByRole('button', { name: 'Update', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Attendance saved');
  await page.getByLabel('Demo account', { exact: true }).selectOption(fixtureId(1));
  await page.goto('/profile');
  await expect(page.locator('.hours-number')).toHaveText('1.0');
});

test('mobile navigation and forms fit without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Service events in your community' }),
  ).toBeVisible();
  await page.evaluate(() =>
    Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {}))),
  );
  await page.screenshot({ path: '.artifacts/home-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Explore Turnout' })).toBeVisible();
  await page.screenshot({
    path: '.artifacts/navigation-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('link', { name: 'Discover', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByRole('heading', { name: 'A cause for every kind of you.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '.artifacts/browse-mobile.png', fullPage: true });
});

test('card navigation supports keyboard dismissal and organization destinations', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Explore Turnout' })).toBeHidden();
  await page.getByLabel('Demo account', { exact: true }).selectOption(fixtureId(4));
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/navigation-desktop.png', fullPage: true });
  await page
    .getByRole('navigation', { name: 'Explore Turnout' })
    .getByRole('link', { name: 'My group', exact: true })
    .click();
  await expect(page).toHaveURL(/\/my-group$/);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('main').click({ position: { x: 10, y: 400 } });
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('about carousel supports buttons, keyboard, and active-slide focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const viewport = page.locator('.about-carousel-viewport');
  await expect(page.getByRole('button', { name: 'Previous slide', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'For volunteers and organizations.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Service events in your community' }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Go to slide 3: What can you do?', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Plan, participate, and stay connected.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeDisabled();
  await viewport.focus();
  await page.keyboard.press('Home');
  await expect(
    page.getByRole('heading', { name: 'Service events in your community' }),
  ).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Meet the organizations', exact: true }),
  ).toBeFocused();
  await viewport.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Find your next event', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/about-audience-desktop.png', fullPage: true });
});

test('about carousel handles drag, touch swipe, and viewport resizing', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const viewport = page.locator('.about-carousel-viewport');
    await expect(
      page.getByRole('heading', { name: 'Service events in your community' }),
    ).toBeVisible();
    const box = (await viewport.boundingBox())!;
    const client = await context.newCDPSession(page);
    const start = box.x + box.width * 0.8,
      end = box.x + box.width * 0.2,
      y = box.y + 95;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: start, y }],
    });
    for (let step = 1; step <= 8; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: start + ((end - start) * step) / 8, y }],
      });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(
      page.getByRole('button', { name: 'Go to slide 2: Who is it for?', exact: true }),
    ).toHaveAttribute('aria-current', 'true');
    await expect
      .poll(async () => Math.abs((await page.locator('#about-slide-2').boundingBox())!.x - box.x))
      .toBeLessThan(2);
    await page.mouse.move(start, y);
    await page.mouse.down();
    await page.mouse.move(end, y, { steps: 10 });
    await page.mouse.up();
    await expect(
      page.getByRole('button', { name: 'Go to slide 3: What can you do?', exact: true }),
    ).toHaveAttribute('aria-current', 'true');
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(async () => {
          const current = (await page.locator('#about-slide-3').boundingBox())!;
          const outer = (await viewport.boundingBox())!;
          return Math.abs(current.x - outer.x);
        })
        .toBeLessThan(2);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page
      .getByRole('button', { name: 'Go to slide 1: What is Turnout?', exact: true })
      .click();
    await expect
      .poll(async () => {
        const current = (await page.locator('#about-slide-1').boundingBox())!;
        const outer = (await viewport.boundingBox())!;
        return Math.abs(current.x - outer.x);
      })
      .toBeLessThan(0.1);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: '.artifacts/about-mobile.png', fullPage: true });
    await page.getByRole('link', { name: 'Explore opportunities', exact: true }).click();
    await expect(page).toHaveURL(/\/browse$/);
  } finally {
    await context.close();
  }
});
