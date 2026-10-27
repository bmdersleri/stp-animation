import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, overlaps, pageOverflow, settled, stepCount } from './helpers';

const PAGE = '/middleware-zinciri/';
const READY = 'svg.plot .seq-lane';
const STEPS = 11;
/** Scene text that must stay apart and inside the stage. */
const LABELS = 'svg.plot text:not(.probe)';
/** Scene boxes that must show all their content; the cards column scrolls on purpose. */
const BOXES = '.istek-karti, .yanit-karti, .terminal, .karsilastirma, .ozet-tablosu';

test.use({ reducedMotion: 'reduce' });

/** A lane's class name sits directly under its label on purpose; their line boxes may touch by half a line. */
const STACKS = [{ upper: '.seq-lane-label', lower: '.seq-lane-sub', within: '.seq-lane', maxShare: 0.5 }];

/**
 * Under the diagram (phone width) the stage scrolls on purpose, so the cards and the lower part of a tall diagram
 * stick out of its box. For each such box (name returned) its nearest scrollable ancestor must contain it in its
 * scroll range, and that ancestor must itself sit inside the stage; the names of boxes that pass are `reachable`,
 * those that do not are `lost`.
 */
async function scrollReach(page: Page, sel: string): Promise<{ reachable: string[]; lost: string[] }> {
  return page.evaluate((sel) => {
    const out = { reachable: [] as string[], lost: [] as string[] };
    const stageEl = document.querySelector<HTMLElement>('.stage');
    if (!stageEl) return { reachable: [], lost: ['no .stage'] };
    const st = stageEl.getBoundingClientRect();
    for (const el of document.querySelectorAll<Element>(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('[hidden]')) continue;
      if (r.left >= st.left - 1 && r.right <= st.right + 1 && r.top >= st.top - 1 && r.bottom <= st.bottom + 1) continue;
      let anc: HTMLElement | null = el.parentElement;
      while (anc && !(['auto', 'scroll'].includes(getComputedStyle(anc).overflowY) && anc.scrollHeight > anc.clientHeight + 1)) anc = anc.parentElement;
      const name = el.getAttribute('class') ?? el.tagName;
      const label = `${name} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
      if (!anc) { out.lost.push(label); continue; }
      const a = anc.getBoundingClientRect();
      const inRange = r.bottom - a.top + anc.scrollTop <= anc.scrollHeight + 1 && r.right - a.left + anc.scrollLeft <= anc.scrollWidth + 1;
      const ancInside = a.left >= st.left - 1 && a.right <= st.right + 1 && a.top >= st.top - 1 && a.bottom <= st.bottom + 1;
      (inRange && ancInside ? out.reachable : out.lost).push(name);
    }
    return out;
  }, sel);
}

const rest = (page: Page) => settled(() => page.locator('.mw-scene').innerHTML());

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < STEPS - 1; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
});

test('lab: turning off next hangs the request', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await page.locator('input[name="gunlukNext"]').uncheck();
  await rest(page);
  await expect(page.locator('.yanit-yok')).toBeVisible();
  await expect(page.locator('.kaynak-rozeti')).toHaveCount(1);
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
    expect(await inViewport(page, 'select[name="yol"]'), at).toBe(true);
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
        const reach = await scrollReach(page, BOXES);
        expect(reach.lost, at).toEqual([]);
        const clipped = (await clippedBoxes(page, BOXES, '.mw-cards')).filter((c) => !(c.endsWith(': outside the stage') && reach.reachable.includes(c.split(':')[0])));
        expect(clipped, at).toEqual([]);
        // the code strip sits under the stage, so the whole Ders page must fit the viewport height
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
    });
  }
}

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 5, 8, 11]) {
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

test('screenshots: ders 5, ders 10, lab 7', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots: Array<['ders' | 'lab', number]> = [['ders', 5], ['ders', 10], ['lab', 7]];
  for (const [mode, n] of shots) {
    await open(page, PAGE, mode, READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`middleware-zinciri-${mode}-${n}.png`);
  }
});
