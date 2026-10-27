import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, outsideStage, overlaps, pageOverflow, settled, stepCount } from './helpers';

const PAGE = '/istek-yanit/';
const READY = 'svg.plot .seq-lane';
const STEPS = 10;
/** Scene text that must stay apart and inside the stage. */
const LABELS = 'svg.plot text:not(.probe)';
/** Scene boxes that must show all their content; the cards column scrolls on purpose. */
const BOXES = '.istek-karti, .yanit-karti, .terminal, .ozet-tablosu';

test.use({ reducedMotion: 'reduce' });

/** A lane's class name sits directly under its label on purpose; their line boxes may touch by half a line. */
const STACKS = [{ upper: '.seq-lane-label', lower: '.seq-lane-sub', within: '.seq-lane', maxShare: 0.5 }];

/**
 * Under the diagram (phone width) the cards scroll inside the stage on purpose, so below the stage box they stick
 * out of it: they must then be reachable by scrolling it (the stage scrolls and its scroll height covers them).
 */
async function cardsReachable(page: Page): Promise<string[]> {
  return page.evaluate((sel) => {
    const out: string[] = [];
    const cards = document.querySelector<HTMLElement>('.istek-cards');
    const area = document.querySelector<HTMLElement>('.istek-stage[data-narrow]');
    if (!cards || !area) return out;
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el.getBoundingClientRect().width === 0) continue;
      const host = [cards, area, document.querySelector<HTMLElement>('.stage')!].find((h) => h.scrollHeight > h.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(h).overflowY));
      if (!host && el.getBoundingClientRect().bottom > document.querySelector('.stage')!.getBoundingClientRect().bottom + 1) out.push(`${el.className} unreachable`);
    }
    return out;
  }, BOXES);
}

const rest = (page: Page) => settled(() => page.locator('.istek-scene').innerHTML());

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < STEPS - 1; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('lab: choosing /api/notlar/ shows 400', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await page.locator('select[name="yol"]').selectOption('/api/notlar/');
  await rest(page);
  await expect(page.locator('.durum-kodu')).toHaveText('400');
  await expect(page.locator('.durum-kodu')).toHaveClass(/alarm/);
  await expect(page.locator('.terminal')).toContainText('[400] Öğrenci numarası eksik.');
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
        expect(await overlaps(page, LABELS, STACKS), at).toEqual([]);
        expect(await outsideStage(page, LABELS), at).toEqual([]);
        const narrow = w < 700;
        const clipped = (await clippedBoxes(page, BOXES, '.istek-cards')).filter((c) => !(narrow && c.endsWith(': outside the stage')));
        expect(clipped, at).toEqual([]);
        if (narrow) expect(await cardsReachable(page), at).toEqual([]);
        // the code strip sits under the stage, so the whole Ders page must fit the viewport height
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
    });
  }
}

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 4, 7, 10]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text, .istek-satir, .yanit-karti .mesaj'),
      tick: await fontSizes(page, 'svg.plot text:not(.probe), .alanlar, .terminal-satir, .ozet-tablosu, .code-trace-lines *'),
      axis: await fontSizes(page, '.kart-baslik'),
    };
    expect(m.title.length, 'step title shown').toBeGreaterThan(0);
    for (const fs of m.title) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of m.body) expect(fs).toBeGreaterThanOrEqual(22);
    for (const fs of [...m.tick, ...m.axis]) expect(fs).toBeGreaterThanOrEqual(18);
    for (const [k, xs] of Object.entries(m)) measured[`${n}.${k}`] = xs.length ? Math.min(...xs) : null;
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(measured) });
});

test('screenshots: ders 7, ders 8, lab 9', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [['ders', 7], ['ders', 8], ['lab', 9]];
  for (const [mode, n] of shots) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`istek-yanit-${mode}-${n}.png`);
  }
});
