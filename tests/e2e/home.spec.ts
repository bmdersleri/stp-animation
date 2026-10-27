import { test, expect } from '@playwright/test';
import { pageOverflow } from './helpers';

test('home: header and one card per concept', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Modern Sunucu Tabanlı Programlama');
  await expect(page.locator('.card')).toHaveCount(15);
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`home: no horizontal page overflow at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.locator('.card')).toHaveCount(15);
    // the page scrolls vertically by design; only sideways overflow is a defect
    expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
  });
}

for (const [href, title] of [
  ['istek-yanit/', "İstek-yanıt yolculuğu: istemciden backend'e"],
  ['event-loop/', 'Event loop: çağrı yığını ve kuyruklar'],
] as const) {
  test(`home: card ${href} opens its page`, async ({ page }) => {
    await page.goto('/');
    await page.locator(`a.card.hazir[href$="${href}"]`).click();
    await expect(page.locator('h1.title')).toHaveText(title);
  });
}
