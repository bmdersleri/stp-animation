import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, overlaps, pageOverflow, scrollReach, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/salt-hash/';
const READY = '.salt-scene .salt-stage';
const STEPS = 9;
/** Scene boxes that must show all their content; the stage scrolls on purpose only at phone width. */
const BOXES = '.segment-strip, .segment-strip-row, .data-table, .terminal, .hat, .sayaclar, .kitap-blok, .yavas-tablo';
/** Boxes checked against the `.salt-stage` box at desktop widths: neither scrolling nor cut by it. */
const STAGE_BOXES = '.salt-main, .salt-yan, .tablo-yeri, .seritler, .segment-strip, .segment-strip-row, .terminal, .data-table, .yavas-tablo, .kitap-blok, .hat, .sayaclar';
/** Texts that must stay apart. */
const TEXTS = '.hat-kutu, .segment-strip-title, .parca, .sayac, .sonuc-satir, .terminal-satir';

test.use({ reducedMotion: 'reduce' });

const rest = (page: Page) => settled(() => page.locator('.salt-scene').innerHTML());

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < STEPS - 1; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('ders: step 2 shows two equal strips and step 7 the counters', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 1, STEPS, 0);
  const hashes = page.locator('.segment-strip .parca-metin');
  await expect(hashes).toHaveCount(2);
  const [a, b] = await hashes.allTextContents();
  expect(a).toHaveLength(64);
  expect(a).toBe(b);
  await gotoStep(page, 6, STEPS, 0);
  await expect(page.locator('.sayac')).toHaveText(['=== : 1 karakter karşılaştırıldı', 'timingSafeEqual : 64 bayt karşılaştırıldı']);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: typing a password recomputes the hash', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 2, STEPS, 0);
  const hash = page.locator('.segment-strip .parca:last-child .parca-metin');
  const before = await hash.first().textContent();
  expect(before).toHaveLength(128);
  await expect(page.locator('.olcum')).toBeHidden();
  await page.locator('input[name="parola"]').fill('baska-Parola-456');
  await expect(page.locator('.olcum')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.olcum')).toContainText('bu tarayıcıda ölçüldü: sha256');
  const after = await hash.first().textContent();
  expect(after).toMatch(/^[0-9a-f]{128}$/);
  expect(after).not.toBe(before);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
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
        // at desktop widths the real containers must neither scroll nor stick out of the scene stage
        if (w === 1280) expect(await stageBoxProblems(page, '.salt-stage', STAGE_BOXES), `${at} boxes`).toEqual([]);
        // the code strip sits under the stage, so the whole Ders page must fit the viewport height
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
    });
  }
}

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 3, 7, 8, 9]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text, .kitap-blok'),
      tick: await fontSizes(page, '.hat-kutu *, .segment-strip *, .data-table, .terminal-satir, .sayac, .sonuc-satir, .code-trace-lines *, .kaynak-rozeti'),
      axis: await fontSizes(page, '.kart-baslik, .segment-strip-title'),
    };
    expect(m.title.length, 'step title shown').toBeGreaterThan(0);
    for (const fs of m.title) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of m.body) expect(fs).toBeGreaterThanOrEqual(22);
    for (const fs of [...m.tick, ...m.axis]) expect(fs, `step ${n}`).toBeGreaterThanOrEqual(18);
    for (const [k, xs] of Object.entries(m)) measured[`${n}.${k}`] = xs.length ? Math.min(...xs) : null;
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(measured) });
});

// no Lab snapshot: the measurement line changes from run to run
test('screenshots: ders 4, ders 7', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const n of [4, 7]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`salt-hash-ders-${n}.png`);
  }
});
