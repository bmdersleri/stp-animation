import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, overlaps, pageOverflow, scrollReach, seqOutsideSvg, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/docker-compose/';
const READY = '.compose-scene .compose-stage';
const STEPS = 11;
/** Scene boxes that must show all their content; the stage scrolls on purpose only at phone width. */
const BOXES = '.data-table, .terminal, .check-list, .compose-diyagram, .kitap-blok, .compose-not';
/** Boxes checked against the `.compose-stage` box at desktop widths. */
const STAGE_BOXES = '.compose-diyagram, .compose-sag, .data-table, .terminal, .check-list, .kitap-blok, .compose-not';
const TEXTS = '.denetim, .terminal-satir, .data-table th, .data-table td, .tanim-metin, .kitap-not, .compose-not';

test.use({ reducedMotion: 'reduce' });

const rest = (page: Page) => settled(() => page.locator('.compose-scene').innerHTML());

async function slide(page: Page, name: string, value: number): Promise<void> {
  await page.locator(`input[name="${name}"]`).evaluate((el, v) => {
    const i = el as HTMLInputElement;
    i.value = String(v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 7 / ${STEPS}`);
  await expect(page.locator('.terminal-satir')).toHaveText('Error: connect ECONNREFUSED 127.0.0.1:5432');
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 8 / ${STEPS}`);
  await expect(page.locator('svg.plot .seq-lane')).toHaveCount(3);
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 9 / ${STEPS}`);
  await expect(page.locator('.denetim-yeri .denetim')).toHaveCount(2);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: localhost fails five attempts', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 8, STEPS, 0);
  await page.locator('select[name="hostAdi"]').selectOption('localhost');
  await rest(page);
  await expect(page.locator('.terminal-satir')).toHaveText('5 denemede veritabanına bağlanılamadı: localhost');
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: dbHazirMs 30000 makes the api başlamadı', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 8, STEPS, 0);
  await slide(page, 'dbHazirMs', 30_000);
  await rest(page);
  await expect(page.locator('.data-table tbody tr').nth(1)).toContainText('başlamadı');
  await expect(page.locator('.terminal-satir')).toContainText('unhealthy');
});

test('lab: extreme parameters fit at 1280x720 and 390', async ({ page }) => {
  for (const [w, h] of [[1280, 720], [390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await open(page, PAGE, 'lab', READY);
    await gotoStep(page, 8, STEPS, 0);
    await page.locator('select[name="mod"]').selectOption('saglikli');
    for (const [dbHazirMs, retries] of [[30_000, 10], [20_000, 10]] as const) {
      await slide(page, 'dbHazirMs', dbHazirMs);
      await slide(page, 'retries', retries);
      await slide(page, 'maksimumDeneme', 10);
      await page.locator('select[name="hostAdi"]').selectOption('localhost');
      await rest(page);
      const at = `${w} db ${dbHazirMs} localhost`;
      expect(await seqOutsideSvg(page), at).toEqual([]);
      expect((await pageOverflow(page)).x, at).toBeLessThanOrEqual(0);
      expect(await page.locator('.denetim-yeri .denetim').count(), at).toBe(5);
      const reach = await scrollReach(page, BOXES);
      expect(reach.lost, at).toEqual([]);
      if (w === 1280) {
        expect(await stageBoxProblems(page, '.compose-stage', STAGE_BOXES), at).toEqual([]);
        expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
      await page.locator('select[name="hostAdi"]').selectOption('kutuphane-db');
      await rest(page);
      expect(await seqOutsideSvg(page), `${at} kutuphane-db`).toEqual([]);
      if (w === 1280) expect(await stageBoxProblems(page, '.compose-stage', STAGE_BOXES), `${at} kutuphane-db`).toEqual([]);
    }
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
        expect(await overlaps(page, TEXTS), at).toEqual([]);
        const reach = await scrollReach(page, BOXES);
        expect(reach.lost, at).toEqual([]);
        const clipped = (await clippedBoxes(page, BOXES)).filter((c) => !(c.endsWith(': outside the stage') && reach.reachable.includes(c.split(':')[0])));
        expect(clipped, at).toEqual([]);
        expect(await seqOutsideSvg(page), `${at} diagram`).toEqual([]);
        if (w === 1280) expect(await stageBoxProblems(page, '.compose-stage', STAGE_BOXES), `${at} boxes`).toEqual([]);
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
        // the diagram starts at its first message on every Ders step: none is faded out as old
        if (mode === 'ders') await expect(page.locator('.seq-msg.old'), `${at} old messages`).toHaveCount(0);
      }
    });
  }
}

test('ders: steps 1 and 11 show the book block at 1280x720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, PAGE, 'ders', READY);
  const blok = page.locator('.kitap-blok');
  await expect(blok).toBeVisible();
  await expect(page.locator('.compose-govde')).toBeHidden();
  await expect(blok.locator('.tanim-metin')).toContainText('Tanım. Docker Compose, birden fazla container');
  await expect(blok.locator('.kitap-not')).toHaveText(/^Sınav Notu: Image salt okunur/);
  expect((await pageOverflow(page)).x, 'step 1').toBeLessThanOrEqual(0);
  expect((await pageOverflow(page)).y, 'step 1').toBeLessThanOrEqual(0);
  expect(await stageBoxProblems(page, '.compose-stage', '.kitap-blok, .tanim-metin, .kitap-not'), 'step 1').toEqual([]);
  await gotoStep(page, STEPS - 1, STEPS, 0);
  await rest(page);
  await expect(blok.locator('.data-table-title')).toHaveText(['Kavram sorumluluk matrisi']);
  await expect(blok.locator('tbody tr')).toHaveCount(7);
  await expect(blok.locator('.kitap-not')).toContainText('savunma katmanı olarak kalmalıdır');
  expect((await pageOverflow(page)).x, 'step 11').toBeLessThanOrEqual(0);
  expect((await pageOverflow(page)).y, 'step 11').toBeLessThanOrEqual(0);
  expect(await stageBoxProblems(page, '.compose-stage', '.kitap-blok, .data-table, .data-table tbody tr, .kitap-not'), 'step 11').toEqual([]);
});

for (const [w, h] of [[1280, 720], [1280, 740]] as const) {
  test(`ders: step 2 shows the L351 definition its badge cites at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, 1, STEPS, 0);
    await rest(page);
    await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toContainText('L351');
    const not = page.locator('.compose-not');
    await expect(not).toHaveCount(1);
    await expect(not).toBeVisible();
    await expect(not).toHaveText(/^Tanım\. Image, bir uygulamanın çalışması için gereken dosya sistemi katmanlarının/);
    await expect(not).not.toHaveClass(/compose-sayfa-notu/);
    expect(await stageBoxProblems(page, '.compose-stage', '.compose-not, .data-table, .terminal'), 'step 2').toEqual([]);
    expect(await clippedBoxes(page, '.compose-not'), 'step 2').toEqual([]);
  });
}

test('ders: the page assumption note is styled apart from book notes', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await gotoStep(page, 9, STEPS, 0);
  await rest(page);
  await expect(page.locator('.compose-not.compose-sayfa-notu')).toHaveText("sayfa varsayımı: veritabanı t = 1 s'de hazır");
  await expect(page.locator('.compose-not:not(.compose-sayfa-notu)')).toHaveText(/^Dikkat noktası: docker-compose\.yml'deki depends_on/);
});

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 8, 9, 10, 11]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text, .kitap-blok'),
      tick: await fontSizes(page, '.denetim, .terminal-satir, .data-table td, .data-table th, .code-trace-lines *, .kaynak-rozeti, .compose-not, svg.plot text:not(.probe)'),
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

for (const n of [9, 10]) {
  test(`screenshot: ders ${n}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`docker-compose-ders-${n}.png`);
  });
}
