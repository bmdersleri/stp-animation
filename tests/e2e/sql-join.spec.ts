import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, pageOverflow, settled, stepCount } from './helpers';

const PAGE = '/sql-join/';
const READY = '.sql-scene .data-table';
const STEPS = 10;
/** Scene boxes that must show all their content. */
const BOXES = '.data-table, .ozet-tablosu, .kosul-rozeti, .iliski, .sira-notu, .parametre-karti, .code-strip';

test.use({ reducedMotion: 'reduce' });

const sql = (page: Page) => settled(() => page.locator('.sql-scene').innerHTML());

/**
 * Under the tables (phone width) the stage scrolls on purpose, so boxes may stick out of its box. For each such box
 * the nearest scrollable ancestor must contain it in its scroll range and sit inside the stage.
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
      if (!anc) { out.lost.push(`${name} "${(el.textContent ?? '').trim().slice(0, 40)}"`); continue; }
      const a = anc.getBoundingClientRect();
      const inRange = r.bottom - a.top + anc.scrollTop <= anc.scrollHeight + 1 && r.right - a.left + anc.scrollLeft <= anc.scrollWidth + 1;
      const ancInside = a.left >= st.left - 1 && a.right <= st.right + 1 && a.top >= st.top - 1 && a.bottom <= st.bottom + 1;
      (inRange && ancInside ? out.reachable : out.lost).push(name);
    }
    return out;
  }, sel);
}

/** Visible containers and tables that scroll internally or are cut by the `.sql-stage` box. */
async function boxProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const st = document.querySelector<HTMLElement>('.sql-stage')!.getBoundingClientRect();
    const out: string[] = [];
    const sel = '.sql-stage, .sql-sol, .sql-sag, .sql-kaynaklar, .sql-orta, .tablo-yeri, .ozet-host, .data-table, .ozet-tablosu, .kosul-rozeti, .code-strip, .code-strip .code-trace';
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.display === 'contents' || el.closest('[hidden]') || cs.display === 'none' || r.width === 0 || r.height === 0) continue;
      const name = el.className;
      if (el.scrollHeight - el.clientHeight > 1) out.push(`${name}: scrolls ${el.scrollHeight - el.clientHeight}`);
      if (r.top < st.top - 1 || r.bottom > st.bottom + 1 || r.left < st.left - 1 || r.right > st.right + 1) out.push(`${name}: outside the stage`);
    }
    return out;
  });
}

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
        await expect(page.locator('.sql-scene .kaynak-rozeti'), at).toHaveCount(1);
        // at desktop widths no table or container may scroll internally or stick out of the scene stage
        if (w === 1280) expect(await boxProblems(page), `${at} boxes`).toEqual([]);
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
