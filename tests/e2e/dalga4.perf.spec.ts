import { test, expect, type Page } from '@playwright/test';
import { gotoStep, open, round } from './helpers';

/*
 * Performance budgets of wave 4: "animations never stutter".
 * They are fixed; a miss is fixed in the code, never here. This file runs in
 * the `performans` project with one worker.
 */

const PAGES = [
  { path: '/docker-compose/', ready: '.compose-scene .compose-stage', steps: 11, control: 'dbHazirMs', values: [2000, 9000, 15000, 4000, 20000] },
  { path: '/nginx-tls/', ready: '.nginx-scene .nginx-stage', steps: 11, control: 'kalanGun', values: [60, 20, 5, 0, 45] },
  { path: '/iot-zaman-serisi/', ready: '.iot-scene .iot-stage', steps: 11, control: 'sicaklik', values: [20, 35.5, -999, 80, 25] },
  { path: '/timeout-retry/', ready: '.timeout-scene .timeout-stage', steps: 10, control: 'zamanAsimiMs', values: [2000, 5000, 1000, 8000, 3000] },
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

for (const { path, ready, control, values } of PAGES) {
  test(`${path} lab changes have no long task`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await open(page, path, 'lab', ready);
    await watchLongTasks(page);
    const input = page.locator(`input[name="${control}"]`);
    for (const v of values) {
      await input.evaluate((el, value) => {
        const i = el as HTMLInputElement;
        i.value = String(value);
        i.dispatchEvent(new Event('input', { bubbles: true }));
      }, v);
      await page.waitForTimeout(400);
    }
    const long = await longTasks(page);
    const d = `${path} lab ${control} long tasks=${long.length} max=${round(Math.max(0, ...long))} ms`;
    info.annotations.push({ type: 'longtask', description: d });
    console.log(d);
    expect(long.filter((x) => x > 50), d).toEqual([]);
  });
}
