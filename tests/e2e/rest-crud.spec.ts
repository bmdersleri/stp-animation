import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, overlaps, pageOverflow, scrollReach, seqOutsideSvg, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/rest-crud/';
const READY = 'svg.plot .seq-lane';
const STEPS = 10;
/** Scene text that must stay apart and inside the stage. */
const LABELS = 'svg.plot text:not(.probe)';
/** Scene boxes that must show all their content; the cards column scrolls on purpose. */
const BOXES = '.istek-karti, .yanit-karti, .terminal, .data-table, .ozet-tablosu, .uc-noktalari, .eslem';

test.use({ reducedMotion: 'reduce' });

/** A lane's class name sits directly under its label on purpose; their line boxes may touch by half a line. */
const STACKS = [{ upper: '.seq-lane-label', lower: '.seq-lane-sub', within: '.seq-lane', maxShare: 0.5 }];

/** Card containers (and the cards in them) checked against the `.rest-stage` box at desktop widths. */
const CARD_BOXES = '.rest-cards, .kol-a, .kol-b, .ozet-host, .eslem, .istek-karti, .yanit-karti, .terminal, .data-table, .ozet-tablosu, .uc-noktalari';

const rest = (page: Page) => settled(() => page.locator('.rest-scene').innerHTML());

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < STEPS - 1; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('lab: two DELETEs show 204 then 404', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await page.locator('select[name="program"]').selectOption('idempotentlik');
  await page.locator('select[name="istek"]').selectOption('delete-12');
  await page.locator('select[name="tekrar"]').selectOption('2');
  await rest(page);
  await expect(page.locator('.yanit-karti .durum-kodu')).toHaveText(['204', '404']);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
  await expect(page.locator('.eslem-rozeti')).toHaveCount(1);
});

/** Whether the element's box lies inside the viewport. */
const inViewport = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
  });

test('lab 1280x720: the code listing scrolls itself, not the side panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, PAGE, 'lab', READY);
  for (let n = 1; n <= STEPS - 1; n++) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const at = `step ${n}`;
    expect(await page.locator('.side').evaluate((el) => el.scrollTop), at).toBe(0);
    expect(await inViewport(page, '.step-title'), at).toBe(true);
    expect(await inViewport(page, 'select[name="program"]'), at).toBe(true);
    // the active line is shown inside the listing's own box
    const shown = await page.locator('.explain-extra .code-trace-lines').evaluate((list) => {
      const li = list.querySelector('li.active');
      if (!li) return true;
      const a = list.getBoundingClientRect();
      const b = li.getBoundingClientRect();
      return b.top >= a.top - 1 && b.bottom <= a.bottom + 1;
    });
    expect(shown, at).toBe(true);
  }
});

test('lab 390x844: a step change does not scroll the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, PAGE, 'lab', READY);
  await page.locator('.stage').focus();
  for (let n = 1; n < STEPS - 1; n++) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press('ArrowRight');
    await expect(stepCount(page)).toHaveText(`Adım ${n + 1} / ${STEPS}`);
    await rest(page);
    expect(await page.evaluate(() => window.scrollY), `step ${n + 1}`).toBe(0);
  }
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
        // diagram text outside the stage box must be reachable by scrolling the stage (phone width only)
        expect((await scrollReach(page, LABELS)).lost, at).toEqual([]);
        // every visible diagram row, the stop mark and the token lie inside the diagram's own svg (it clips them)
        expect(await seqOutsideSvg(page), `${at} diagram rows`).toEqual([]);
        const reach = await scrollReach(page, BOXES);
        expect(reach.lost, at).toEqual([]);
        const clipped = (await clippedBoxes(page, BOXES, '.rest-cards')).filter((c) => !(c.endsWith(': outside the stage') && reach.reachable.includes(c.split(':')[0])));
        expect(clipped, at).toEqual([]);
        // at desktop widths the boxes holding cards, table and summary must neither scroll nor stick out of the scene stage
        // (`.rest-cards` is `display: contents` in the Lab layout, so the real containers are checked)
        if (w === 1280) {
          const bad = await stageBoxProblems(page, '.rest-stage', CARD_BOXES);
          expect(bad, `${at} card boxes`).toEqual([]);
        }
        // the code strip sits under the stage, so the whole Ders page must fit the viewport height
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
    });
  }
}

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 2, 7, 10]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text, .istek-satir, .yanit-karti .mesaj'),
      tick: await fontSizes(page, 'svg.plot text:not(.probe), .alanlar, .terminal-satir, .ozet-tablosu, .code-trace-lines *, .kaynak-rozeti'),
      axis: await fontSizes(page, '.kart-baslik'),
    };
    expect(m.title.length, 'step title shown').toBeGreaterThan(0);
    expect(m.tick.length, 'diagram text shown').toBeGreaterThan(0);
    for (const fs of m.title) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of m.body) expect(fs).toBeGreaterThanOrEqual(22);
    for (const fs of [...m.tick, ...m.axis]) expect(fs).toBeGreaterThanOrEqual(18);
    for (const [k, xs] of Object.entries(m)) measured[`${n}.${k}`] = xs.length ? Math.min(...xs) : null;
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(measured) });
});

test('screenshots: ders 2, ders 9', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const n of [2, 9]) {
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`rest-crud-ders-${n}.png`);
  }
});
