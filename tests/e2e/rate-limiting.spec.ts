import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, overlaps, pageOverflow, scrollReach, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/rate-limiting/';
const READY = '.rate-scene .rate-stage';
const STEPS = 10;
/** Scene boxes that must show all their content; the stage scrolls on purpose only at phone width. */
const BOXES = '.data-table, .terminal, .check-list, .rate-cizelge';
/** Boxes checked against the `.rate-stage` box at desktop widths. */
const STAGE_BOXES = '.rate-cizelge, .rate-alt, .data-table, .terminal, .check-list';
const TEXTS = '.denetim, .terminal-satir, .data-table th, .data-table td';

test.use({ reducedMotion: 'reduce' });

const rest = (page: Page) => settled(() => page.locator('.rate-scene').innerHTML());

/** Dots and labels that leave the svg, and labels that touch each other or a dot. */
const timelineProblems = (page: Page) =>
  page.evaluate(() => {
    const svg = document.querySelector('svg.plot')!;
    const s = svg.getBoundingClientRect();
    const out: string[] = [];
    const inside = (r: DOMRect): boolean => r.left >= s.left - 0.5 && r.right <= s.right + 0.5 && r.top >= s.top - 0.5 && r.bottom <= s.bottom + 0.5;
    for (const d of svg.querySelectorAll('.rate-dot')) if (!inside(d.getBoundingClientRect())) out.push('dot outside svg');
    const labels = [...svg.querySelectorAll('text:not(.probe)')].filter((t) => (t.textContent ?? '').trim() !== '');
    for (const t of labels) if (!inside(t.getBoundingClientRect())) out.push(`label "${t.textContent}" outside svg`);
    const hit = (a: DOMRect, b: DOMRect): boolean => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    labels.forEach((l, i) => {
      for (const m of labels.slice(i + 1)) if (hit(l.getBoundingClientRect(), m.getBoundingClientRect())) out.push(`label "${l.textContent}" x "${m.textContent}"`);
      for (const d of svg.querySelectorAll('.rate-dot')) if (hit(l.getBoundingClientRect(), d.getBoundingClientRect())) out.push(`label "${l.textContent}" x dot`);
    });
    return out;
  });

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 4 / ${STEPS}`);
  await expect(page.locator('svg.plot .rate-nokta.red')).toHaveCount(2);
  await expect(page.locator('.terminal-satir')).toHaveCount(5);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 7 / ${STEPS}`);
  await expect(page.locator('svg.plot .rate-bant')).toHaveCount(2);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.denetim-yeri')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: lowering the limit turns accepted dots orange', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 3, STEPS, 0);
  await rest(page);
  await expect(page.locator('svg.plot .rate-nokta.izin')).toHaveCount(3);
  await page.locator('input[name="maksimumIstek"]').fill('1');
  await rest(page);
  await expect(page.locator('svg.plot .rate-nokta.izin')).toHaveCount(1);
  await expect(page.locator('svg.plot .rate-nokta.red')).toHaveCount(4);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: elle pattern sends requests and moves time', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await page.locator('select[name="desen"]').selectOption('elle');
  for (let i = 0; i < 10; i++) {
    await page.locator('button[name="gonder"]').click();
    if (i % 3 === 2) await page.locator('button[name="ilerle"]').click();
  }
  await rest(page);
  await expect(page.locator('svg.plot .rate-dot')).toHaveCount(10);
  expect(await timelineProblems(page)).toEqual([]);
  await page.locator('button[name="sifirla"]').click();
  await rest(page);
  await expect(page.locator('svg.plot .rate-dot')).toHaveCount(0);
});

for (const [w, h] of [[1280, 720], [1280, 740], [390, 844]] as const) {
  for (const mode of ['ders', 'lab'] as const) {
    test(`${mode}: every step fits at ${w}x${h}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: w, height: h });
      await open(page, PAGE, mode, READY);
      for (let n = 1; n <= STEPS; n++) {
        await gotoStep(page, n - 1, STEPS, 0);
        await rest(page);
        const at = `${mode} ${w}x${h} step ${n}`;
        expect((await pageOverflow(page)).x, at).toBeLessThanOrEqual(0);
        expect(await overlaps(page, TEXTS), at).toEqual([]);
        const reach = await scrollReach(page, BOXES);
        expect(reach.lost, at).toEqual([]);
        const clipped = (await clippedBoxes(page, BOXES)).filter((c) => !(c.endsWith(': outside the stage') && reach.reachable.includes(c.split(':')[0])));
        expect(clipped, at).toEqual([]);
        expect(await timelineProblems(page), `${at} timeline`).toEqual([]);
        if (w === 1280) expect(await stageBoxProblems(page, '.rate-stage', STAGE_BOXES), `${at} boxes`).toEqual([]);
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
    });
  }
}

test('lab: elle with 10 requests fits at 1280x720 and 390', async ({ page }) => {
  for (const [w, h] of [[1280, 720], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await open(page, PAGE, 'lab', READY);
    await page.locator('select[name="desen"]').selectOption('elle');
    for (let i = 0; i < 10; i++) await page.locator('button[name="gonder"]').click();
    await rest(page);
    expect(await timelineProblems(page), `${w}`).toEqual([]);
    expect((await pageOverflow(page)).x, `${w}`).toBeLessThanOrEqual(0);
    const reach = await scrollReach(page, BOXES);
    expect(reach.lost, `${w}`).toEqual([]);
  }
});

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 4, 7, 8, 10]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text'),
      tick: await fontSizes(page, '.denetim, .terminal-satir, .data-table td, .data-table th, .code-trace-lines *, .kaynak-rozeti, .rate-lejant, svg.plot text:not(.probe)'),
      axis: await fontSizes(page, '.kart-baslik, .check-list-title, .data-table-title'),
    };
    expect(m.title.length, 'step title shown').toBeGreaterThan(0);
    for (const fs of m.title) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of m.body) expect(fs).toBeGreaterThanOrEqual(22);
    for (const fs of [...m.tick, ...m.axis]) expect(fs, `step ${n}`).toBeGreaterThanOrEqual(18);
    for (const [k, xs] of Object.entries(m)) measured[`${n}.${k}`] = xs.length ? Math.min(...xs) : null;
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(measured) });
});

for (const n of [7, 8]) {
  test(`screenshot: ders ${n}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`rate-limiting-ders-${n}.png`);
  });
}
