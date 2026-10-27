import { test, expect } from '@playwright/test';
import { gotoStep, open, p95, round } from './helpers';

/*
 * Performance budgets of wave 1: "animations never stutter".
 * They are fixed; a miss is fixed in the code, never here. This file runs in
 * the `performans` project with one worker.
 */

const PAGES = [
  { path: '/istek-yanit/', ready: 'svg.plot .seq-lane', steps: 10 },
  { path: '/event-loop/', ready: '.tahta', steps: 11 },
];

test('step changes cause no long task', async ({ page }, info) => {
  test.setTimeout(120_000);
  for (const { path, ready, steps } of PAGES) {
    await open(page, path, 'ders', ready);
    await page.evaluate(() => {
      const w = window as unknown as { __long: number[] };
      w.__long = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__long.push(e.duration);
      }).observe({ type: 'longtask', buffered: true });
    });
    for (let n = 0; n < steps; n++) await gotoStep(page, n, steps, 700);
    for (let n = steps - 2; n >= 0; n--) await gotoStep(page, n, steps, 700);
    const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
    const d = `${path} long tasks=${long.length} max=${round(Math.max(0, ...long))} ms`;
    info.annotations.push({ type: 'longtask', description: d });
    console.log(d);
    expect(long.filter((x) => x > 50), d).toEqual([]);
  }
});

test('kare range stays under 16 ms', async ({ page }, info) => {
  await open(page, '/event-loop/', 'lab', '.tahta');
  await page.locator('select[name="program"]').selectOption('kod-4-5');
  const durations = await page.evaluate(async () => {
    const kare = document.querySelector<HTMLInputElement>('input[name="kare"]')!;
    const last = Number(kare.max);
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    performance.clearMeasures('loop-render');
    for (let i = 0; i < 30; i++) {
      kare.value = String(i % 2 === 0 ? last : Math.floor(last / 2));
      kare.dispatchEvent(new Event('input', { bubbles: true }));
      await frame();
      await frame();
    }
    return performance.getEntriesByName('loop-render', 'measure').slice(-300).map((e) => e.duration);
  });
  expect(durations.length).toBeGreaterThanOrEqual(30);
  const p = p95(durations);
  const d = `n=${durations.length} p95=${round(p)} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'loop-render', description: d });
  console.log('loop-render', d);
  expect(p).toBeLessThan(16);
});
