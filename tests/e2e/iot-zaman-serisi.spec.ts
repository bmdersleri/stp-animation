import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, labelCollisions, open, overlaps, pageOverflow, scrollReach, seqOutsideSvg, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/iot-zaman-serisi/';
const READY = '.iot-scene .iot-stage';
const STEPS = 11;
/** Scene boxes that must show all their content; the stage scrolls on purpose only at phone width. */
const BOXES = '.data-table, .terminal, .check-list, .segment-strip, .iot-seri, .iot-diyagram, .kitap-blok, .iot-not';
/** Boxes checked against the `.iot-stage` box at desktop widths. */
const STAGE_BOXES = '.iot-seri, .iot-diyagram, .iot-sag, .iot-kolonlar, .data-table, .terminal, .check-list, .segment-strip, .kitap-blok, .iot-not';
const TEXTS = '.denetim, .terminal-satir, .data-table th, .data-table td, .tanim-metin, .kitap-not, .iot-not, .segment-strip-title';

test.use({ reducedMotion: 'reduce' });

const rest = (page: Page) => settled(() => page.locator('.iot-scene').innerHTML());

/** Real gap: the right column, its columns and each check list end at least 4 px above the stage bottom (the stage clips at 1 px). */
const slackProblems = (page: Page): Promise<string[]> => page.evaluate(() => {
  const st = document.querySelector('.iot-stage')!.getBoundingClientRect();
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('.iot-sag, .iot-kolonlar, .iot-sag .check-list')) {
    if (el.closest('[hidden]') || el.getBoundingClientRect().height === 0) continue;
    const gap = st.bottom - el.getBoundingClientRect().bottom;
    if (gap < 4) out.push(`${el.className}: ${gap.toFixed(1)} px above the stage bottom`);
  }
  return out;
});

/** Chart texts must stay inside the chart svg and clear of each other and of the dots. */
const chartProblems = (page: Page): Promise<string[]> => page.evaluate(() => {
  const svg = document.querySelector<SVGSVGElement>('.iot-seri svg.plot');
  if (!svg || svg.closest('[hidden]')) return [];
  const s = svg.getBoundingClientRect();
  const hit = (a: DOMRect, b: DOMRect): boolean => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const items = [...svg.querySelectorAll<SVGGraphicsElement>('text.tick:not(.probe), circle.seri-nokta')].filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none');
  const out: string[] = [];
  const name = (e: Element): string => `${e.getAttribute('class')} "${(e.textContent ?? '').trim()}"`;
  items.forEach((e, i) => {
    const r = e.getBoundingClientRect();
    if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) out.push(`${name(e)} outside the chart svg`);
    for (const f of items.slice(i + 1)) {
      if (e.tagName === 'circle' && f.tagName === 'circle') continue;
      if (hit(r, f.getBoundingClientRect())) out.push(`${name(e)} x ${name(f)}`);
    }
  });
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
  await expect(page.locator('.iot-seri circle.seri-nokta')).toHaveCount(1);
  await expect(page.locator('.terminal-satir')).toHaveText('Kaydedildi: -999°C');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 6 / ${STEPS}`);
  await expect(page.locator('.imza-yeri .segment-strip')).toHaveCount(2);
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 7 / ${STEPS}`);
  await expect(page.locator('.iot-seri circle.seri-nokta')).toHaveCount(2);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 10 / ${STEPS}`);
  await expect(page.locator('.ozet-yeri tbody tr')).toHaveCount(3);
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: sicaklik -999 fails the range check', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 4, STEPS, 0);
  await slide(page, 'sicaklik', -999);
  await rest(page);
  const nokta = page.locator('.iot-seri circle.seri-nokta');
  await expect(nokta).toHaveCount(1);
  await expect(nokta).toHaveAttribute('fill', '#F08A00');
  await expect(page.locator('.iot-seri .seri-deger')).toHaveText('−999 °C · ');
  await expect(page.locator('.iot-seri .seri-kayitsiz')).toHaveText('kaydedilmedi');
  await expect(page.locator('.terminal-satir')).toHaveText("false [ 'sicaklik aralık dışı (-40 ile 85 arası bekleniyor).' ]");
  await expect(page.locator('.denetim-yeri .denetim-kaldi .denetim-ad')).toHaveText('Sıcaklık');
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
  expect(await chartProblems(page)).toEqual([]);
  expect(await labelCollisions(page, '.iot-seri svg.plot')).toEqual([]);
});

test('lab: saatFarki 65 fails the window', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 4, STEPS, 0);
  await slide(page, 'saatFarki', 65);
  await rest(page);
  await expect(page.locator('.denetim-yeri .denetim-kaldi .denetim-ad')).toHaveText('Zaman penceresi');
  await expect(page.locator('.terminal-satir')).toHaveText('Zaman damgası süresi dolmuş veya geçersiz (Replay Attack riski).');
  await expect(page.locator('.iot-seri circle.seri-nokta')).toHaveAttribute('fill', '#F08A00');
  await slide(page, 'saatFarki', 60);
  await rest(page);
  await expect(page.locator('.denetim-yeri .denetim-kaldi')).toHaveCount(0);
  await expect(page.locator('.iot-seri circle.seri-nokta')).toHaveAttribute('fill', '#0EA5A4');
});

/** Heavy Lab states: every one must fit and keep its exact counts. */
const EKSTREM: { ad: string; ayar: (page: Page) => Promise<void>; noktalar: number; terminal: number; serit: number; kaldi: string | null }[] = [
  {
    ad: 'both ranges out, repeated',
    ayar: async (p) => { await slide(p, 'sicaklik', -999); await slide(p, 'nem', 110); await p.locator('input[name="tekrar"]').check(); },
    noktalar: 2, terminal: 8, serit: 0, kaldi: 'Sıcaklık',
  },
  {
    ad: 'changed body',
    ayar: async (p) => { await p.locator('select[name="govde"]').selectOption('degismis'); },
    noktalar: 1, terminal: 1, serit: 2, kaldi: 'HMAC',
  },
  {
    ad: 'unknown device',
    ayar: async (p) => { await p.locator('select[name="govde"]').selectOption('bilinmeyen'); },
    noktalar: 1, terminal: 1, serit: 0, kaldi: 'Cihaz UUID',
  },
  {
    ad: 'clock 120 s ahead',
    ayar: async (p) => { await slide(p, 'saatFarki', 120); },
    noktalar: 1, terminal: 1, serit: 0, kaldi: 'Zaman penceresi',
  },
  {
    ad: 'accepted, repeated, 40 s behind',
    ayar: async (p) => { await slide(p, 'saatFarki', -40); await p.locator('input[name="tekrar"]').check(); },
    noktalar: 2, terminal: 4, serit: 0, kaldi: null,
  },
];

for (const [w, h] of [[1280, 720], [390, 844]] as const) {
  for (const e of EKSTREM) {
    test(`lab: ${e.ad} fits at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, PAGE, 'lab', READY);
      await gotoStep(page, 4, STEPS, 0);
      await e.ayar(page);
      await rest(page);
      await expect(page.locator('.iot-seri circle.seri-nokta')).toHaveCount(e.noktalar);
      await expect(page.locator('.terminal-satir')).toHaveCount(e.terminal);
      if (e.serit > 0 || w === 390) await expect(page.locator('.imza-yeri .segment-strip')).toHaveCount(e.serit);
      if (e.kaldi) await expect(page.locator('.denetim-yeri .denetim-kaldi .denetim-ad').first()).toHaveText(e.kaldi);
      else await expect(page.locator('.denetim-yeri .denetim-kaldi')).toHaveCount(0);
      expect(await chartProblems(page), 'chart').toEqual([]);
      expect(await seqOutsideSvg(page), 'diagram').toEqual([]);
      const reach = await scrollReach(page, BOXES);
      expect(reach.lost).toEqual([]);
      if (w === 1280) {
        expect(await stageBoxProblems(page, '.iot-stage', STAGE_BOXES)).toEqual([]);
        expect(await slackProblems(page)).toEqual([]);
      }
      expect((await pageOverflow(page)).x).toBeLessThanOrEqual(0);
    });
  }
}

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
        expect(await chartProblems(page), `${at} chart`).toEqual([]);
        expect(await labelCollisions(page, '.iot-seri svg.plot'), `${at} labels`).toEqual([]);
        if (w === 1280) expect(await stageBoxProblems(page, '.iot-stage', STAGE_BOXES), `${at} boxes`).toEqual([]);
        if (w === 1280) expect(await slackProblems(page), `${at} slack`).toEqual([]);
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
        // the diagram starts at its first message on every Ders step: none is faded out as old
        if (mode === 'ders') await expect(page.locator('.seq-msg.old'), `${at} old messages`).toHaveCount(0);
      }
    });
  }
}

/** Key pieces the spec names per Ders step: they must be shown, inside the stage and unclipped at 1280x720 (nothing is dropped for them). */
const KEY_STEPS: { n: number; check: (page: Page) => Promise<void> }[] = [
  { n: 2, check: async (p) => {
    await expect(p.locator('.iot-seri circle.seri-nokta')).toHaveCount(1);
    await expect(p.locator('.terminal-satir')).toHaveText('Kaydedildi: -999°C');
  } },
  { n: 3, check: async (p) => {
    await expect(p.locator('.arguman-yeri tbody tr')).toHaveCount(4);
    await expect(p.locator('.imza-yeri .segment-strip')).toHaveCount(1);
  } },
  { n: 4, check: async (p) => {
    await expect(p.locator('.denetim-yeri .denetim')).toHaveCount(5);
    await expect(p.locator('.denetim-yeri .denetim-kaldi .denetim-ad')).toHaveText('Zaman penceresi');
    await expect(p.locator('.terminal-satir')).toHaveText('Zaman damgası süresi dolmuş veya geçersiz (Replay Attack riski).');
  } },
  { n: 5, check: async (p) => {
    await expect(p.locator('.denetim-yeri .denetim-gecti')).toHaveCount(3);
    await expect(p.locator('.denetim-yeri .denetim-bekliyor')).toHaveCount(2);
  } },
  { n: 6, check: async (p) => {
    await expect(p.locator('.denetim-yeri .denetim-kaldi .denetim-ad')).toHaveText('HMAC');
    await expect(p.locator('.imza-yeri .segment-strip')).toHaveCount(2);
    await expect(p.locator('.terminal-satir')).toHaveText('HMAC imzası geçersiz; veri yolda değiştirilmiş olabilir.');
    await expect(p.locator('.iot-seri circle.seri-nokta')).toHaveAttribute('fill', '#F08A00');
  } },
  { n: 7, check: async (p) => {
    await expect(p.locator('.denetim-yeri .denetim-gecti')).toHaveCount(5);
    await expect(p.locator('.kayit-yeri tbody tr')).toHaveCount(2);
    await expect(p.locator('.terminal-satir')).toHaveCount(4);
    const cx = await p.locator('.iot-seri circle.seri-nokta').evaluateAll((c) => c.map((e) => Number(e.getAttribute('cx'))));
    expect(cx).toHaveLength(2);
    expect(Math.abs(cx[1] - cx[0]), 'the two points are visibly apart').toBeGreaterThanOrEqual(8);
  } },
  { n: 8, check: async (p) => {
    await expect(p.locator('.denetim-yeri .denetim')).toHaveCount(5);
    await expect(p.locator('.denetim-yeri .denetim-kaldi .denetim-ad')).toHaveText('Sıcaklık');
    await expect(p.locator('.terminal-satir')).toHaveCount(3);
  } },
  { n: 9, check: async (p) => {
    await expect(p.locator('.kayit-yeri tbody tr')).toHaveCount(1);
    await expect(p.locator('.kayit-yeri tbody')).toContainText('2026-09-05T10:00:00.000Z');
    await expect(p.locator('.denetim-yeri .denetim-gecti')).toHaveCount(5);
    await expect(p.locator('.terminal-satir')).toHaveCount(2);
  } },
  { n: 10, check: async (p) => {
    await expect(p.locator('.ozet-yeri tbody tr')).toHaveCount(3);
    await expect(p.locator('.tampon-yeri tbody tr')).toHaveCount(2);
    await expect(p.locator('.terminal-satir').first()).toHaveText('SELECT');
  } },
];

for (const k of KEY_STEPS) {
  test(`ders: step ${k.n} shows its key pieces at 1280x720`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, k.n - 1, STEPS, 0);
    await rest(page);
    await k.check(page);
    // the key pieces are inside the stage and unclipped, and none of them was left out for room
    expect(await stageBoxProblems(page, '.iot-stage', '.iot-seri, .check-list, .data-table, .terminal, .segment-strip'), `step ${k.n}`).toEqual([]);
    const birakilan = (await page.locator('.iot-govde').getAttribute('data-birakilan')) ?? '';
    expect(birakilan, `step ${k.n} dropped`).toMatch(/^(arguman|sira|not|\s)*$/);
  });
}

test('ders: steps 1 and 11 show the book block at 1280x720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, PAGE, 'ders', READY);
  const blok = page.locator('.kitap-blok');
  await expect(blok).toBeVisible();
  await expect(page.locator('.iot-govde')).toBeHidden();
  await expect(page.locator('.code-strip')).toBeHidden();
  await expect(blok.locator('.tanim-metin')).toContainText('IoT backend geliştirme, fiziksel cihazlardan');
  await expect(blok.locator('.kitap-not')).toHaveCount(1);
  await expect(blok.locator('.kitap-not')).toContainText('Derinlemesine: Bir kullanıcı hatalı veri girerse');
  expect((await pageOverflow(page)).x, 'step 1').toBeLessThanOrEqual(0);
  expect((await pageOverflow(page)).y, 'step 1').toBeLessThanOrEqual(0);
  expect(await stageBoxProblems(page, '.iot-stage', '.kitap-blok, .tanim-metin, .kitap-not'), 'step 1').toEqual([]);
  await gotoStep(page, STEPS - 1, STEPS, 0);
  await rest(page);
  await expect(page.locator('.code-strip')).toBeHidden();
  await expect(blok.locator('.data-table-title')).toHaveText(['Alternatifler']);
  await expect(blok.locator('tbody tr')).toHaveCount(4);
  await expect(blok.locator('.kitap-not').first()).toContainText('Sınav Notu: Cihaz kimliği API anahtarıyla doğrulanır');
  expect((await pageOverflow(page)).x, 'step 11').toBeLessThanOrEqual(0);
  expect((await pageOverflow(page)).y, 'step 11').toBeLessThanOrEqual(0);
  expect(await stageBoxProblems(page, '.iot-stage', '.kitap-blok, .data-table, .data-table tbody tr, .kitap-not, .kitap-paragraf'), 'step 11').toEqual([]);
});

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 2, 4, 6, 7, 10, 11]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text, .kitap-blok'),
      tick: await fontSizes(page, '.denetim, .terminal-satir, .data-table td, .data-table th, .code-trace-lines *, .kaynak-rozeti, .iot-not, .segment-strip-row, svg.plot text:not(.probe)'),
      axis: await fontSizes(page, '.kart-baslik, .check-list-title, .data-table-title, .segment-strip-title'),
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
    await expect(page).toHaveScreenshot(`iot-zaman-serisi-ders-${n}.png`);
  });
}
