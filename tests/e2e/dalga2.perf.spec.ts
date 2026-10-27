import { test, expect } from '@playwright/test';
import { gotoStep, open, p95, round } from './helpers';

/*
 * Performance budgets of wave 2: "animations never stutter".
 * They are fixed; a miss is fixed in the code, never here. This file runs in
 * the `performans` project with one worker.
 */

const PAGES = [
  { path: '/middleware-zinciri/', ready: 'svg.plot .seq-lane', steps: 11 },
  { path: '/rest-crud/', ready: 'svg.plot .seq-lane', steps: 10 },
  { path: '/sql-join/', ready: '.sql-scene .data-table', steps: 10 },
  { path: '/katmanli-mimari/', ready: 'svg.plot .seq-lane', steps: 11 },
];

for (const { path, ready, steps } of PAGES) {
  test(`${path} step change has no long task`, async ({ page }, info) => {
    test.setTimeout(120_000);
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
  });
}

test('sql-join lab pair slider p95 under 16 ms', async ({ page }, info) => {
  await open(page, '/sql-join/', 'lab', '.sql-scene .data-table');
  const durations = await page.evaluate(async () => {
    const cift = document.querySelector<HTMLInputElement>('input[type=range][name="cift"]')!;
    const last = Number(cift.max);
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const out: number[] = [];
    for (let i = 0; i < 30; i++) {
      cift.value = String(i % 2 === 0 ? last : 0);
      // The wait for the next vsync is not the page's cost (we dispatch right after a frame, so it
      // would always add ~16.7 ms); measure the input handler plus the forced style/layout it causes.
      const t0 = performance.now();
      cift.dispatchEvent(new Event('input', { bubbles: true }));
      void document.body.getBoundingClientRect();
      out.push(performance.now() - t0);
      await frame();
      await frame();
    }
    return out;
  });
  expect(durations.length).toBe(30);
  const p = p95(durations);
  const d = `n=${durations.length} p95=${round(p)} ms max=${round(Math.max(...durations))} ms`;
  info.annotations.push({ type: 'cift-input', description: d });
  console.log('cift-input', d);
  expect(p).toBeLessThan(16);
});
