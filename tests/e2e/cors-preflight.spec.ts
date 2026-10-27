import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, overlaps, pageOverflow, scrollReach, seqOutsideSvg, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/cors-preflight/';
const READY = '.cors-scene .cors-stage';
const STEPS = 10;
/** Scene boxes that must show all their content; the stage scrolls on purpose only at phone width. */
const BOXES = '.istek-karti, .yanit-karti, .terminal, .check-list, .cors-aciklama, .koken-etiketi';
/** Boxes checked against the `.cors-stage` box at desktop widths: neither scrolling nor cut by it. */
const STAGE_BOXES = '.cors-main, .cors-yan, .http-cards, .istek-karti, .yanit-karti, .terminal, .check-list, .cors-diyagram';
/** Texts that must stay apart. */
const TEXTS = '.denetim, .terminal-satir, .istek-satir, .cors-aciklama, .koken-etiketi';

test.use({ reducedMotion: 'reduce' });

/** Lane titles hyphenated by a break, and arrow labels sticking out past the ends of their own arrow (a label crossing a lane line). */
const laneProblems = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const t of document.querySelectorAll('svg.plot .seq-lane-label')) if (/-\s*$/.test(t.textContent ?? '') || [...t.children].some((c) => /-$/.test(c.textContent ?? ''))) out.push(`lane title "${t.textContent}"`);
    for (const m of document.querySelectorAll('svg.plot g.seq-msg:not(.old)')) {
      const a = m.querySelector('path.seq-arrow')?.getBoundingClientRect();
      const l = m.querySelector('text.seq-msg-label')?.getBoundingClientRect();
      if (a && l && l.width > 0 && (l.left < a.left - 4 || l.right > a.right + 4)) out.push(`label "${m.querySelector('text.seq-msg-label')!.textContent}" crosses its lanes`);
    }
    return out;
  });

const rest = (page: Page) => settled(() => page.locator('.cors-scene').innerHTML());

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 3 / ${STEPS}`);
  await expect(page.locator('svg.plot .seq-lane')).toHaveCount(3);
  await expect(page.locator('.cors-aciklama')).toHaveText('Tarayıcı yanıtı betiğe vermedi; sunucu isteği işledi.');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 8 / ${STEPS}`);
  await expect(page.locator('.eksik-baslik')).toHaveText('Access-Control-Allow-Headers: yok');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.yanit-karti .sira')).toHaveText(['#1', '#2']);
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: switching server to cors package lets the POST through', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 7, STEPS, 0);
  await expect(page.locator('.eksik-baslik')).toHaveCount(1);
  await page.locator('select[name="sunucu"]').selectOption('cors-paketi');
  await rest(page);
  await expect(page.locator('.eksik-baslik')).toHaveCount(0);
  await expect(page.locator('.yanit-karti .sira')).toHaveText(['#1', '#2']);
  await expect(page.locator('.denetim-kaldi')).toHaveCount(0);
  await page.locator('select[name="istek"]').selectOption('delete');
  await rest(page);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
  await expect(page.locator('select[name="kimlik"]')).toBeEnabled();
  await page.locator('select[name="istemci"]').selectOption('curl');
  await expect(page.locator('select[name="kimlik"]')).toBeDisabled();
  await page.locator('select[name="istemci"]').selectOption('tarayici');
  await page.keyboard.press('o');
  await rest(page);
  await expect(page.locator('select[name="koken"]')).toHaveValue('localhost');
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
        if (w === 1280 && mode === 'ders') expect(await laneProblems(page), `${at} lanes`).toEqual([]);
        if (w === 1280) expect(await stageBoxProblems(page, '.cors-stage', STAGE_BOXES), `${at} boxes`).toEqual([]);
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
    });
  }
}

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 3, 8, 9, 10]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text'),
      tick: await fontSizes(page, '.denetim, .terminal-satir, .cors-aciklama, .koken-etiketi, .code-trace-lines *, .kaynak-rozeti, svg.plot text:not(.probe)'),
      axis: await fontSizes(page, '.kart-baslik, .check-list-title'),
    };
    expect(m.title.length, 'step title shown').toBeGreaterThan(0);
    for (const fs of m.title) expect(fs).toBeGreaterThanOrEqual(32);
    for (const fs of m.body) expect(fs).toBeGreaterThanOrEqual(22);
    for (const fs of [...m.tick, ...m.axis]) expect(fs, `step ${n}`).toBeGreaterThanOrEqual(18);
    for (const [k, xs] of Object.entries(m)) measured[`${n}.${k}`] = xs.length ? Math.min(...xs) : null;
  }
  info.annotations.push({ type: 'min font-size px', description: JSON.stringify(measured) });
});

test('ders: the request card shows on steps 3, 8 and 9 at 1280x720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, PAGE, 'ders', READY);
  const metot = { 3: ['GET'], 8: ['OPTIONS'], 9: ['POST'] } as const;
  for (const n of [3, 8, 9] as const) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page.locator('.istek-karti:visible'), `step ${n}`).toHaveCount(1);
    await expect(page.locator('.istek-karti .metot'), `step ${n}`).toHaveText([...metot[n]]);
    expect(await stageBoxProblems(page, '.cors-stage', '.istek-karti, .yanit-karti, .check-list'), `step ${n}`).toEqual([]);
  }
  await expect(page.locator('.yanit-karti .sira')).toHaveText(['#1', '#2']);
  await expect(page.locator('.yanit-karti .durum-kodu')).toHaveText(['204', '200']);
});

for (const n of [3, 8, 9]) {
  test(`screenshot: ders ${n}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`cors-preflight-ders-${n}.png`);
  });
}
