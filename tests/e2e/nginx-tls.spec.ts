import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, overlaps, pageOverflow, scrollReach, seqOutsideSvg, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/nginx-tls/';
const READY = '.nginx-scene .nginx-stage';
const STEPS = 11;
/** Scene boxes that must show all their content; the stage scrolls on purpose only at phone width. */
const BOXES = '.data-table, .terminal, .check-list, .segment-strip, .http-cards > div, .nginx-diyagram, .kitap-blok, .nginx-not';
/** Boxes checked against the `.nginx-stage` box at desktop widths. */
const STAGE_BOXES = '.nginx-diyagram, .nginx-sag, .data-table, .terminal, .check-list, .segment-strip, .kitap-blok, .nginx-not';
const TEXTS = '.denetim, .terminal-satir, .data-table th, .data-table td, .tanim-metin, .kitap-not, .nginx-not, .yanit-yok';

test.use({ reducedMotion: 'reduce' });

const rest = (page: Page) => settled(() => page.locator('.nginx-scene').innerHTML());

/** Real gap: the sag column area and each check list end at least 4 px above the stage bottom (the stage clips at 1 px). */
const slackProblems = (page: Page): Promise<string[]> => page.evaluate(() => {
  const st = document.querySelector('.nginx-stage')!.getBoundingClientRect();
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('.nginx-sag, .nginx-sag-kolon, .nginx-sag .check-list')) {
    if (el.closest('[hidden]') || el.getBoundingClientRect().height === 0) continue;
    const gap = st.bottom - el.getBoundingClientRect().bottom;
    if (gap < 4) out.push(`${el.className}: ${gap.toFixed(1)} px above the stage bottom`);
  }
  return out;
});

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
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 2 / ${STEPS}`);
  await expect(page.locator('svg.plot .seq-lane')).toHaveCount(4);
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 7 / ${STEPS}`);
  await expect(page.locator('.yanit-karti')).toContainText('301');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 10 / ${STEPS}`);
  await expect(page.locator('.yanit-karti')).toContainText('502');
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: kod-15-3 on port 80 shows the X-Forwarded-For row', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 2, STEPS, 0);
  await page.locator('select[name="hedef"]').selectOption('http-80');
  await page.locator('select[name="ayar"]').selectOption('kod-15-3');
  await page.locator('select[name="sahteXff"]').selectOption('var');
  await page.locator('select[name="trustProxy"]').selectOption('2');
  await rest(page);
  await expect(page.locator('.gorulen-yeri tbody tr', { hasText: 'X-Forwarded-For' })).toBeVisible();
  await expect(page.locator('.xff-yeri .segment-strip')).toBeVisible();
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: kalanGun 0 gives no response', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 7, STEPS, 0);
  await slide(page, 'kalanGun', 0);
  await rest(page);
  await expect(page.locator('.sertifika-yeri tbody')).toContainText('suresi-doldu');
  await expect(page.locator('.gorulen-yeri')).toBeHidden();
  await expect(page.locator('.nginx-sag-kolon > p.yanit-yok')).toHaveText('yanıt yok: tarayıcı güvensiz uyarısı (sertifika süresi dolmuş)');
  await expect(page.locator('.certbot-yeri .denetim').nth(2)).toContainText('süresi dolmuş');
});

test('lab: https default with certbot fits at 1280x720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 7, STEPS, 0);
  await slide(page, 'kalanGun', 60);
  await rest(page);
  await expect(page.locator('.certbot-yeri .denetim')).toHaveCount(3);
  expect(await stageBoxProblems(page, '.nginx-stage', STAGE_BOXES)).toEqual([]);
  expect(await slackProblems(page)).toEqual([]);
  expect(await seqOutsideSvg(page)).toEqual([]);
});

test('lab: ufw drop gives no response', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 2, STEPS, 0);
  await page.locator('select[name="hedef"]').selectOption('port-3000');
  await rest(page);
  await expect(page.locator('.nginx-sag-kolon > p.yanit-yok')).toHaveText('yanıt yok: paket düşürüldü');
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
        if (w === 1280) expect(await stageBoxProblems(page, '.nginx-stage', STAGE_BOXES), `${at} boxes`).toEqual([]);
        if (w === 1280 && mode === 'ders') expect(await slackProblems(page), `${at} slack`).toEqual([]);
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
  await expect(page.locator('.nginx-govde')).toBeHidden();
  await expect(blok.locator('.tanim-metin')).toContainText('Reverse proxy, istemcilerden gelen HTTP(S) isteklerini');
  await expect(blok.locator('.kitap-not')).toHaveCount(2);
  await expect(blok.locator('.kitap-not').first()).toContainText('502 Bad Gateway yanıtı bu nedenle');
  await expect(blok.locator('.kitap-not').nth(1)).toContainText('127.0.0.1 üzerinde dinlediğine');
  expect((await pageOverflow(page)).x, 'step 1').toBeLessThanOrEqual(0);
  expect((await pageOverflow(page)).y, 'step 1').toBeLessThanOrEqual(0);
  expect(await stageBoxProblems(page, '.nginx-stage', '.kitap-blok, .tanim-metin, .kitap-not'), 'step 1').toEqual([]);
  await gotoStep(page, STEPS - 1, STEPS, 0);
  await rest(page);
  await expect(blok.locator('.data-table-title')).toHaveText(['Alternatifler', 'Alternatifler']);
  await expect(blok.locator('tbody tr')).toHaveCount(8);
  await expect(blok.locator('.kitap-not')).toContainText('Sınav Notu: Nginx trafiği API');
  expect((await pageOverflow(page)).x, 'step 11').toBeLessThanOrEqual(0);
  expect((await pageOverflow(page)).y, 'step 11').toBeLessThanOrEqual(0);
  expect(await stageBoxProblems(page, '.nginx-stage', '.kitap-blok, .data-table, .data-table tbody tr, .kitap-not'), 'step 11').toEqual([]);
});

test('ders: steps 8 and 10 start the diagram at the client with the folded UFW pass', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  for (const n of [8, 10]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page.locator('.seq-msg.old'), `step ${n}`).toHaveCount(0);
    const ilk = page.locator('.nginx-diyagram g.seq-msg').first();
    await expect(ilk, `step ${n}`).toHaveAttribute('data-id', 'istek');
    await expect(ilk, `step ${n}`).toBeVisible();
    await expect(ilk.locator('text.seq-msg-label'), `step ${n}`).toHaveText('GET :443 · UFW izin');
    // the rest of the TLS path is still drawn in full
    await expect(page.locator('.nginx-diyagram g.seq-msg[data-id="tls-hello"]'), `step ${n}`).toBeVisible();
    expect(await seqOutsideSvg(page), `step ${n}`).toEqual([]);
  }
  await expect(page.locator('.nginx-not.nginx-sayfa-notu')).toHaveCount(0);
  await gotoStep(page, 7, STEPS, 0);
  await rest(page);
  await expect(page.locator('.nginx-not.nginx-sayfa-notu')).toHaveText(/^Nginx varsayılanı: /);
});

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 2, 6, 8, 10, 11]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text, .kitap-blok'),
      tick: await fontSizes(page, '.denetim, .terminal-satir, .data-table td, .data-table th, .code-trace-lines *, .kaynak-rozeti, .nginx-not, svg.plot text:not(.probe)'),
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

for (const n of [6, 10]) {
  test(`screenshot: ders ${n}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`nginx-tls-ders-${n}.png`);
  });
}
