import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, pageOverflow, scrollReach, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/sql-join/';
const READY = '.sql-scene .data-table';
const STEPS = 10;
/** Scene boxes that must show all their content. */
const BOXES = '.data-table, .ozet-tablosu, .kosul-rozeti, .iliski, .sira-notu, .parametre-karti, .kitap-ciktisi, .code-strip';

test.use({ reducedMotion: 'reduce' });

const sql = (page: Page) => settled(() => page.locator('.sql-scene').innerHTML());

/** Containers and tables checked against the `.sql-stage` box at desktop widths. */
const STAGE_BOXES = '.sql-stage, .sql-sol, .sql-sag, .sql-kaynaklar, .sql-orta, .tablo-yeri, .ozet-host, .data-table, .ozet-tablosu, .kosul-rozeti, .kitap-ciktisi, .code-strip, .code-strip .code-trace';

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < STEPS - 1; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('lab: moving the pair slider changes the condition badge', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await page.locator('select[name="sorgu"]').selectOption('inner');
  await sql(page);
  const cift = page.locator('input[name="cift"]');
  await cift.fill('1');
  await sql(page);
  await expect(page.locator('.kosul-rozeti')).toHaveClass(/dogru/);
  const first = await page.locator('.kosul-rozeti').textContent();
  await cift.fill('2');
  await sql(page);
  await expect(page.locator('.kosul-rozeti')).toHaveClass(/yanlis/);
  expect(await page.locator('.kosul-rozeti').textContent()).not.toBe(first);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
  await page.keyboard.press(']');
  await expect(cift).toHaveValue('3');
});

for (const [w, h] of [[1280, 720], [1280, 740], [390, 844]] as const) {
  for (const mode of ['ders', 'lab'] as const) {
    test(`${mode}: every step fits at ${w}x${h}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: w, height: h });
      await open(page, PAGE, mode, READY);
      for (let n = 1; n <= STEPS; n++) {
        await gotoStep(page, n - 1, STEPS, 0);
        await sql(page);
        const at = `${mode} ${w}x${h} step ${n}`;
        expect((await pageOverflow(page)).x, at).toBeLessThanOrEqual(0);
        const reach = await scrollReach(page, BOXES);
        expect(reach.lost, at).toEqual([]);
        const clipped = (await clippedBoxes(page, BOXES)).filter((c) => !(c.endsWith(': outside the stage') && reach.reachable.includes(c.split(':')[0])));
        expect(clipped, at).toEqual([]);
        // one step badge; step 3 adds the book output's own badge inside its box
        await expect(page.locator('.sql-scene .rozet-yeri .kaynak-rozeti'), at).toHaveCount(1);
        // at desktop widths no table or container may scroll internally or stick out of the scene stage
        if (w === 1280) expect(await stageBoxProblems(page, '.sql-stage', STAGE_BOXES), `${at} boxes`).toEqual([]);
        // the code strip sits under the tables, so the whole Ders page must fit the viewport height
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
    });
  }
}

test('ders: the code strip shows the deciding line', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 3, STEPS, 0);
  await sql(page);
  await expect(page.locator('.code-strip li.active')).toContainText('ON');
  await gotoStep(page, 7, STEPS, 0);
  await sql(page);
  await expect(page.locator('.code-strip li.active')).toContainText('WHERE');
});

test('ders 1280x720: the strip shows the whole query, SELECT included', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  for (let n = 3; n <= 9; n++) {
    await gotoStep(page, n - 1, STEPS, 0);
    await sql(page);
    const first = page.locator('.code-strip li').first();
    await expect(first, `step ${n}`).toContainText('SELECT');
    const fit = await page.evaluate(() => {
      const list = document.querySelector('.code-strip .code-trace-lines')!.getBoundingClientRect();
      const li = document.querySelector('.code-strip li')!.getBoundingClientRect();
      return li.top >= list.top - 1 && li.bottom <= list.bottom + 1;
    });
    expect(fit, `step ${n} first line inside the strip`).toBe(true);
  }
});

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 4, 8, 10]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await sql(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text'),
      tick: await fontSizes(page, '.data-table table, .data-table-title, .kosul-rozeti, .iliski, .sira-notu, .parametre-karti, .ozet-tablosu, .ozet-sayilar, .code-trace-lines *, .kaynak-rozeti'),
    };
    expect(m.title.length, 'step title shown').toBeGreaterThan(0);
    expect(m.tick.length, 'scene text shown').toBeGreaterThan(0);
    for (const fs of m.title) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of m.body) expect(fs).toBeGreaterThanOrEqual(22);
    for (const fs of m.tick) expect(fs).toBeGreaterThanOrEqual(18);
    for (const [k, xs] of Object.entries(m)) measured[`${n}.${k}`] = xs.length ? Math.min(...xs) : null;
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(measured) });
});

test('screenshots: ders 6, ders 8', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const n of [6, 8]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await sql(page);
    await expect(page).toHaveScreenshot(`sql-join-ders-${n}.png`);
  }
});
