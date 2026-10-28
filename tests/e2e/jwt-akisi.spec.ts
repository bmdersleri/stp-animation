import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, overlaps, pageOverflow, scrollReach, seqOutsideSvg, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/jwt-akisi/';
const READY = '.jwt-scene .jwt-stage';
const STEPS = 11;
/** Scene boxes that must show all their content; the stage scrolls on purpose only at phone width. */
const BOXES = '.segment-strip, .segment-strip-row, .json-kutu, .check-list, .terminal, .kitap-blok';
/** Boxes checked against the `.jwt-stage` box at desktop widths: neither scrolling nor cut by it. */
const STAGE_BOXES = '.jwt-main, .jwt-yan, .token-yeri, .imzalar, .json-kutular, .json-kutu, .segment-strip, .segment-strip-row, .check-list, .terminal, .kitap-blok, .jwt-diyagram';
/** Texts that must stay apart. */
const TEXTS = '.segment-strip-title, .parca, .json-baslik, .denetim, .terminal-satir';

test.use({ reducedMotion: 'reduce' });

const rest = (page: Page) => settled(() => page.locator('.jwt-scene').innerHTML());

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < STEPS - 1; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await expect(page.locator('svg.plot .seq-lane')).toHaveCount(2);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: role change fails at signature', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 5, STEPS, 0);
  await page.locator('select[name="bozulma"]').selectOption('rol-degisti');
  await rest(page);
  await expect(page.locator('.denetim-kaldi .denetim-ad')).toHaveText('İmza');
  await expect(page.locator('.denetim-atlandi')).toHaveCount(3);
  await expect(page.locator('.terminal-satir')).toHaveText(['401: Token imzası geçersiz.']);
  await expect(page.locator('.imzalar .segment-strip')).toHaveCount(2);
  await expect(page.locator('.imzalar .fark').first()).toBeVisible();
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
  await page.keyboard.press('b');
  await expect(page.locator('select[name="bozulma"]')).toHaveValue('sure-alani-yok');
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
        expect(await seqOutsideSvg(page), `${at} diagram rows`).toEqual([]);
        expect(await overlaps(page, TEXTS), at).toEqual([]);
        const reach = await scrollReach(page, BOXES);
        expect(reach.lost, at).toEqual([]);
        const clipped = (await clippedBoxes(page, BOXES)).filter((c) => !(c.endsWith(': outside the stage') && reach.reachable.includes(c.split(':')[0])));
        expect(clipped, at).toEqual([]);
        // at desktop widths the real containers must neither scroll nor stick out of the scene stage
        if (w === 1280) expect(await stageBoxProblems(page, '.jwt-stage', STAGE_BOXES), `${at} boxes`).toEqual([]);
        // the code strip sits under the stage, so the whole Ders page must fit the viewport height
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
    });
  }
}

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 3, 8, 10, 11]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text, .kitap-blok'),
      tick: await fontSizes(page, '.segment-strip *, .json-metin, .denetim, .terminal-satir, .code-trace-lines *, .kaynak-rozeti, svg.plot text:not(.probe)'),
      axis: await fontSizes(page, '.kart-baslik, .segment-strip-title, .json-baslik, .check-list-title'),
    };
    expect(m.title.length, 'step title shown').toBeGreaterThan(0);
    for (const fs of m.title) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of m.body) expect(fs).toBeGreaterThanOrEqual(22);
    for (const fs of [...m.tick, ...m.axis]) expect(fs, `step ${n}`).toBeGreaterThanOrEqual(18);
    for (const [k, xs] of Object.entries(m)) measured[`${n}.${k}`] = xs.length ? Math.min(...xs) : null;
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(measured) });
});

test('screenshots: ders 6, ders 8', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const n of [6, 8]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`jwt-akisi-ders-${n}.png`);
  }
});
