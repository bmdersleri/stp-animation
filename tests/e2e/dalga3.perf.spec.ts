import { test, expect, type Page } from '@playwright/test';
import { gotoStep, open, round } from './helpers';

/*
 * Performance budgets of wave 3: "animations never stutter".
 * They are fixed; a miss is fixed in the code, never here. This file runs in
 * the `performans` project with one worker.
 */

const PAGES = [
  { path: '/salt-hash/', ready: '.salt-scene .salt-stage', steps: 9 },
  { path: '/jwt-akisi/', ready: '.jwt-scene .jwt-stage', steps: 11 },
  { path: '/rbac-401-403/', ready: '.rbac-scene .rbac-stage', steps: 11 },
  { path: '/cors-preflight/', ready: '.cors-scene .cors-stage', steps: 10 },
  { path: '/rate-limiting/', ready: '.rate-scene .rate-stage', steps: 10 },
];

async function watchLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__long.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
}

const longTasks = (page: Page): Promise<number[]> =>
  page.evaluate(() => (window as unknown as { __long: number[] }).__long);

for (const { path, ready, steps } of PAGES) {
  test(`${path} step change has no long task`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await open(page, path, 'ders', ready);
    await watchLongTasks(page);
    for (let n = 0; n < steps; n++) await gotoStep(page, n, steps, 700);
    for (let n = steps - 2; n >= 0; n--) await gotoStep(page, n, steps, 700);
    const long = await longTasks(page);
    const d = `${path} long tasks=${long.length} max=${round(Math.max(0, ...long))} ms`;
    info.annotations.push({ type: 'longtask', description: d });
    console.log(d);
    expect(long.filter((x) => x > 50), d).toEqual([]);
  });
}

test('salt-hash lab typing has no long task', async ({ page }, info) => {
  test.setTimeout(120_000);
  await open(page, '/salt-hash/', 'lab', '.salt-scene .salt-stage');
  await watchLongTasks(page);
  const parola = page.locator('input[name="parola"]');
  await parola.fill('');
  await parola.pressSequentially('Parola12', { delay: 80 });
  await expect(parola).toHaveValue('Parola12');
  // the scrypt work yields with asyncTick; give it time to finish while the observer keeps watching
  await page.waitForTimeout(4000);
  const long = await longTasks(page);
  const d = `salt-hash lab typing long tasks=${long.length} max=${round(Math.max(0, ...long))} ms`;
  info.annotations.push({ type: 'longtask', description: d });
  console.log(d);
  expect(long.filter((x) => x > 50), d).toEqual([]);
});
