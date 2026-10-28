import { test, expect, type Page } from '@playwright/test';
import { clippedBoxes, fontSizes, gotoStep, open, overlaps, pageOverflow, scrollReach, seqOutsideSvg, settled, stageBoxProblems, stepCount } from './helpers';

const PAGE = '/timeout-retry/';
const READY = '.timeout-scene .timeout-stage';
const STEPS = 10;
/** Scene boxes that must show all their content; the stage scrolls on purpose only at phone width. */
const BOXES = '.data-table, .terminal, .check-list, .timeout-zaman, .timeout-diyagram, .kitap-blok, .timeout-not, .uyari, .http-cards';
/** Boxes checked against the `.timeout-stage` box at desktop widths. */
const STAGE_BOXES = '.timeout-zaman, .timeout-diyagram, .timeout-sag, .timeout-kolonlar, .data-table, .terminal, .check-list, .kitap-blok, .timeout-not, .uyari, .http-cards';
const TEXTS = '.denetim, .terminal-satir, .data-table th, .data-table td, .tanim-metin, .kitap-not, .timeout-not, .uyari';

test.use({ reducedMotion: 'reduce' });

const rest = (page: Page) => settled(() => page.locator('.timeout-scene').innerHTML());

/** Real gap: the right column, its stack and each check list end at least 4 px above the stage bottom (the stage clips at 1 px). */
const slackProblems = (page: Page): Promise<string[]> => page.evaluate(() => {
  const st = document.querySelector('.timeout-stage')!.getBoundingClientRect();
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('.timeout-sag, .timeout-kolonlar, .timeout-sag .check-list')) {
    if (el.closest('[hidden]') || el.getBoundingClientRect().height === 0) continue;
    const gap = st.bottom - el.getBoundingClientRect().bottom;
    if (gap < 4) out.push(`${el.className}: ${gap.toFixed(1)} px above the stage bottom`);
  }
  return out;
});

/** The time axis: every text, bar and tip stays inside its svg and the texts stay clear of each other, of the bars and of the tips. */
const zamanProblems = (page: Page): Promise<string[]> => page.evaluate(() => {
  const svg = document.querySelector<SVGSVGElement>('svg.plot.zaman');
  if (!svg || svg.closest('[hidden]')) return [];
  const s = svg.getBoundingClientRect();
  const hit = (a: DOMRect, b: DOMRect): boolean => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const items = [...svg.querySelectorAll<SVGGraphicsElement>('text.tick:not(.probe), rect.deneme-cubuk, circle.zaman-uc')]
    .filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none');
  const out: string[] = [];
  const name = (e: Element): string => `${e.getAttribute('class')} "${(e.textContent ?? '').trim()}"`;
  items.forEach((e, i) => {
    const r = e.getBoundingClientRect();
    if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) out.push(`${name(e)} outside the axis svg`);
    for (const f of items.slice(i + 1)) {
      const ikisiDeText = e.tagName === 'text' || f.tagName === 'text';
      if (ikisiDeText && hit(r, f.getBoundingClientRect())) out.push(`${name(e)} x ${name(f)}`);
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

/** The heaviest Lab run: timeout 10 000, three retries, base 2000, slow leg 12 000 (54 000 ms in all, past the 30 000 ms axis). */
async function enUzun(page: Page): Promise<void> {
  await slide(page, 'zamanAsimiMs', 10_000);
  await slide(page, 'maksRetry', 3);
  await slide(page, 'servisGecikmesiMs', 12_000);
  await page.locator('select[name="senaryo"]').selectOption('yavas');
  await page.locator('select[name="beklemeTabanMs"]').selectOption('2000');
}

test('ders keyboard walkthrough', async ({ page }) => {
  await open(page, PAGE, 'ders', READY);
  await expect(stepCount(page)).toHaveText(`Adım 1 / ${STEPS}`);
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 2 / ${STEPS}`);
  await expect(page.locator('svg.plot.zaman rect.deneme-cubuk')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 3 / ${STEPS}`);
  await expect(page.locator('svg.plot.zaman text.toplam')).toHaveText('toplam 5000 ms');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 7 / ${STEPS}`);
  await expect(page.locator('svg.plot.zaman g.bekle text')).toHaveText('bekle 1000 ms');
  await expect(page.locator('svg.plot.zaman text.toplam')).toHaveText('toplam 7200 ms');
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım 9 / ${STEPS}`);
  await expect(page.locator('.denetim-yeri .denetim-kaldi .denetim-ad')).toHaveText('Doğrulama');
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS} / ${STEPS}`);
  await page.keyboard.press('ArrowLeft');
  await expect(stepCount(page)).toHaveText(`Adım ${STEPS - 1} / ${STEPS}`);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
});

test('lab: maksRetry 0 on gecici gives özet yok', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 6, STEPS, 0);
  await slide(page, 'maksRetry', 0);
  await rest(page);
  await expect(page.locator('.timeout-kart .http-yanit, .timeout-kart')).toContainText('özet yok');
  await expect(page.locator('svg.plot.zaman text.toplam')).toHaveText('toplam 5000 ms');
  await expect(page.locator('svg.plot.zaman rect.deneme-cubuk')).toHaveCount(1);
  await expect(page.locator('svg.plot.zaman g.bekle')).toHaveCount(0);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
  await expect(page.locator('.timeout-diyagram g.seq-msg').last()).toContainText('200 OK (özet yok,');
  await expect(page.locator('.timeout-diyagram g.seq-msg').last()).toContainText('temel veri korunur)');
  expect(await zamanProblems(page)).toEqual([]);
});

test('lab: the longest run stays inside the axis', async ({ page }) => {
  await open(page, PAGE, 'lab', READY);
  await gotoStep(page, 6, STEPS, 0);
  await enUzun(page);
  await rest(page);
  // 4 x 10 000 ms + 2000 + 4000 + 8000 = 54 000 ms on a 30 000 ms axis: the third bar is cut at the edge, the fourth is off the axis
  await expect(page.locator('svg.plot.zaman text.toplam')).toHaveText('toplam 54000 ms');
  await expect(page.locator('svg.plot.zaman rect.deneme-cubuk')).toHaveCount(3);
  await expect(page.locator('svg.plot.zaman g.bekle')).toHaveCount(2);
  await expect(page.locator('svg.plot.zaman g.zaman-satir[data-uc="kesik"] text.zaman-elips')).toBeVisible();
  await expect(page.locator('svg.plot.zaman .zaman-tick text').last()).toHaveText('30 s');
  await expect(page.locator('.timeout-diyagram g.seq-msg')).not.toHaveCount(0);
  await expect(page.locator('.rozet-yeri .kaynak-rozeti')).toHaveCount(1);
  expect(await zamanProblems(page)).toEqual([]);
  const svg = (await page.locator('svg.plot.zaman').boundingBox())!;
  for (const sel of ['rect.deneme-cubuk', 'text.toplam', 'g.bekle text', 'text.zaman-elips', 'line.zaman-asimi']) {
    for (const box of await page.locator(`svg.plot.zaman ${sel}`).evaluateAll((es) => es.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.width]; }))) {
      if (box[2] === 0) continue;
      expect(box[0], sel).toBeGreaterThanOrEqual(svg.x - 1);
      expect(box[1], sel).toBeLessThanOrEqual(svg.x + svg.width + 1);
    }
  }
});

/** Heavy Lab states: every one must fit and keep its exact counts. */
const EKSTREM: { ad: string; ayar: (page: Page) => Promise<void>; cubuk: number; bosluk: number; toplam: string; uyari: boolean; terminal: number }[] = [
  { ad: 'longest run', ayar: enUzun, cubuk: 3, bosluk: 2, toplam: 'toplam 54000 ms', uyari: false, terminal: 2 },
  {
    ad: 'three retries with no wait',
    ayar: async (p) => { await slide(p, 'zamanAsimiMs', 10_000); await slide(p, 'maksRetry', 3); await slide(p, 'servisGecikmesiMs', 12_000); await p.locator('select[name="senaryo"]').selectOption('yavas'); await p.locator('select[name="beklemeTabanMs"]').selectOption('0'); },
    cubuk: 3, bosluk: 0, toplam: 'toplam 40000 ms', uyari: true, terminal: 2,
  },
  {
    ad: 'one second timeout, hızlı service',
    ayar: async (p) => { await slide(p, 'zamanAsimiMs', 1000); await p.locator('select[name="senaryo"]').selectOption('hizli'); },
    cubuk: 2, bosluk: 1, toplam: 'toplam 3000 ms', uyari: false, terminal: 2,
  },
  {
    ad: 'http-500 is not retried',
    ayar: async (p) => { await p.locator('select[name="senaryo"]').selectOption('http-500'); await slide(p, 'maksRetry', 3); },
    cubuk: 1, bosluk: 0, toplam: 'toplam 1200 ms', uyari: false, terminal: 2,
  },
  {
    ad: 'two retries, base 500',
    ayar: async (p) => { await p.locator('select[name="senaryo"]').selectOption('yavas'); await slide(p, 'maksRetry', 2); await p.locator('select[name="beklemeTabanMs"]').selectOption('500'); },
    cubuk: 3, bosluk: 2, toplam: 'toplam 16500 ms', uyari: false, terminal: 2,
  },
];

for (const [w, h] of [[1280, 720], [390, 844]] as const) {
  for (const e of EKSTREM) {
    test(`lab: ${e.ad} fits at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, PAGE, 'lab', READY);
      await gotoStep(page, 6, STEPS, 0);
      await e.ayar(page);
      await rest(page);
      await expect(page.locator('svg.plot.zaman text.toplam')).toHaveText(e.toplam);
      await expect(page.locator('svg.plot.zaman rect.deneme-cubuk')).toHaveCount(e.cubuk);
      await expect(page.locator('svg.plot.zaman g.bekle')).toHaveCount(e.bosluk);
      await expect(page.locator('p.uyari')).toHaveCount(e.uyari ? 1 : 0);
      await expect(page.locator('.terminal-satir')).toHaveCount(e.terminal);
      expect(await zamanProblems(page), 'axis').toEqual([]);
      expect(await seqOutsideSvg(page), 'diagram').toEqual([]);
      const reach = await scrollReach(page, BOXES);
      expect(reach.lost).toEqual([]);
      if (w === 1280) {
        expect(await stageBoxProblems(page, '.timeout-stage', STAGE_BOXES)).toEqual([]);
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
        expect(await zamanProblems(page), `${at} axis`).toEqual([]);
        if (w === 1280) expect(await stageBoxProblems(page, '.timeout-stage', STAGE_BOXES), `${at} boxes`).toEqual([]);
        if (w === 1280) expect(await slackProblems(page), `${at} slack`).toEqual([]);
        if (mode === 'ders' && w === 1280) expect((await pageOverflow(page)).y, at).toBeLessThanOrEqual(0);
      }
    });
  }
}

/** Key pieces the spec names per Ders step: they must be shown, inside the stage and unclipped at 1280x720 (nothing is dropped for them). */
const KEY_STEPS: { n: number; check: (page: Page) => Promise<void> }[] = [
  { n: 2, check: async (p) => {
    await expect(p.locator('svg.plot.zaman rect.deneme-cubuk')).toHaveCount(1);
    await expect(p.locator('svg.plot.zaman g.zaman-satir[data-uc="sonsuz"] text.zaman-elips')).toBeVisible();
    await expect(p.locator('svg.plot.zaman line.zaman-asimi')).toHaveCount(0);
    await expect(p.locator('svg.plot.zaman text.toplam')).toHaveCount(0);
  } },
  { n: 3, check: async (p) => {
    await expect(p.locator('svg.plot.zaman circle.zaman-uc')).toHaveAttribute('fill', '#F08A00');
    await expect(p.locator('svg.plot.zaman text.toplam')).toHaveText('toplam 5000 ms');
    await expect(p.locator('svg.plot.zaman .zaman-asimi-etiket')).toHaveText('zaman aşımı 5000 ms');
    await expect(p.locator('.timeout-kart')).toContainText('özet yok');
    await expect(p.locator('.terminal-satir')).toHaveText(['Özet alınamadı, kitap bilgisi özetsiz gösterilecek: AI servisi zaman aşımına uğradı.', 'null']);
    await expect(p.locator('.timeout-sayfa-notu')).toHaveCount(1);
    await expect(p.locator('.timeout-diyagram')).not.toContainText('200 OK');
  } },
  { n: 4, check: async (p) => {
    await expect(p.locator('svg.plot.zaman circle.zaman-uc')).toHaveAttribute('fill', '#0EA5A4');
    await expect(p.locator('svg.plot.zaman text.toplam')).toHaveText('toplam 1200 ms');
    await expect(p.locator('.terminal-satir')).toHaveText(['Kısa bir özet metni.']);
    await expect(p.locator('.timeout-diyagram')).not.toContainText('200 OK');
  } },
  { n: 5, check: async (p) => {
    await expect(p.locator('.timeout-zaman')).toBeHidden();
    await expect(p.locator('.timeout-kart')).toContainText('200');
    await expect(p.locator('.terminal-satir')).toHaveCount(3);
    await expect(p.locator('.terminal-satir').first()).toHaveText('Kısa bir özet metni.');
  } },
  { n: 6, check: async (p) => {
    await expect(p.locator('.hata-yeri tbody tr')).toHaveCount(2);
    await expect(p.locator('.hata-yeri tbody')).toContainText('GeciciAiHatasi');
    await expect(p.locator('.terminal-satir')).toHaveText(['Özet alınamadı, kitap bilgisi özetsiz gösterilecek: AI servisi kalıcı bir hata döndürdü.', 'null']);
  } },
  { n: 7, check: async (p) => {
    await expect(p.locator('svg.plot.zaman rect.deneme-cubuk')).toHaveCount(2);
    await expect(p.locator('svg.plot.zaman g.bekle text')).toHaveText('bekle 1000 ms');
    await expect(p.locator('svg.plot.zaman text.toplam')).toHaveText('toplam 7200 ms');
    await expect(p.locator('.timeout-kart')).toContainText('özet: Kısa ve öz bir özet.');
    await expect(p.locator('.timeout-sayfa-notu')).toHaveCount(2);
    // no closing 17.5 arrow before step 8
    await expect(p.locator('.timeout-diyagram')).not.toContainText('200 OK');
  } },
  { n: 8, check: async (p) => {
    await expect(p.locator('svg.plot.zaman rect.deneme-cubuk')).toHaveCount(2);
    await expect(p.locator('svg.plot.zaman text.toplam')).toHaveText('toplam 11000 ms');
    await expect(p.locator('.timeout-kart')).toContainText('özet yok');
    await expect(p.locator('.terminal-satir').first()).toHaveText('Özet alınamadı: AI servisi zaman aşımına uğradı.');
    await expect(p.locator('.timeout-sayfa-notu')).toHaveCount(2);
    // the closing 17.5 arrow is on screen, inside the diagram's svg
    await expect(p.locator('.timeout-govde')).not.toHaveAttribute('data-birakilan', /sira/);
    const ok = p.locator('.timeout-diyagram g.seq-msg').last();
    await expect(ok).toContainText('200 OK (özet yok,');
    await expect(ok).toContainText('veri korunur)');
    expect(await seqOutsideSvg(p)).toEqual([]);
    const svg = (await p.locator('.timeout-diyagram svg.plot').boundingBox())!;
    const kutu = (await ok.boundingBox())!;
    expect(kutu.y).toBeGreaterThanOrEqual(svg.y - 1);
    expect(kutu.y + kutu.height).toBeLessThanOrEqual(svg.y + svg.height + 1);
  } },
  { n: 9, check: async (p) => {
    await expect(p.locator('.timeout-zaman')).toBeHidden();
    await expect(p.locator('.denetim-yeri .denetim')).toHaveCount(2);
    await expect(p.locator('.denetim-yeri .denetim-gecti .denetim-ad')).toHaveText('Zaman aşımı');
    await expect(p.locator('.denetim-yeri .denetim-kaldi .denetim-ad')).toHaveText('Doğrulama');
    await expect(p.locator('.terminal-satir')).toHaveCount(5);
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
    expect(await stageBoxProblems(page, '.timeout-stage', '.timeout-zaman, .check-list, .data-table, .terminal, .http-cards, .timeout-sayfa-notu, .uyari'), `step ${k.n}`).toEqual([]);
    const birakilan = (await page.locator('.timeout-govde').getAttribute('data-birakilan')) ?? '';
    expect(birakilan, `step ${k.n} dropped`).toMatch(/^(sira|not|\s)*$/);
    // steps 1 and 10 and the others: only steps 1 and 10 hide the code strip
    await expect(page.locator('.code-strip')).toBeVisible();
  });
}

test('ders: steps 1 and 10 show the book block at 1280x720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page, PAGE, 'ders', READY);
  const blok = page.locator('.kitap-blok');
  await expect(blok).toBeVisible();
  await expect(page.locator('.timeout-govde')).toBeHidden();
  await expect(page.locator('.code-strip')).toBeHidden();
  await expect(blok.locator('.tanim-metin')).toContainText('Timeout, bir AI servisinden belirli bir süre içinde yanıt gelmezse');
  await expect(blok.locator('.kitap-paragraf')).toContainText('Neden vardır?');
  expect((await pageOverflow(page)).x, 'step 1').toBeLessThanOrEqual(0);
  expect((await pageOverflow(page)).y, 'step 1').toBeLessThanOrEqual(0);
  expect(await stageBoxProblems(page, '.timeout-stage', '.kitap-blok, .tanim-metin, .kitap-paragraf'), 'step 1').toEqual([]);
  await gotoStep(page, STEPS - 1, STEPS, 0);
  await rest(page);
  await expect(page.locator('.code-strip')).toBeHidden();
  await expect(blok.locator('.data-table-title')).toHaveText(['Alternatifler']);
  await expect(blok.locator('tbody tr')).toHaveCount(5);
  await expect(blok.locator('.kitap-not')).toContainText('Bu üç halkanın hangisinin kodlandığını');
  expect((await pageOverflow(page)).x, 'step 10').toBeLessThanOrEqual(0);
  expect((await pageOverflow(page)).y, 'step 10').toBeLessThanOrEqual(0);
  expect(await stageBoxProblems(page, '.timeout-stage', '.kitap-blok, .data-table, .data-table tbody tr, .kitap-not, .kitap-paragraf'), 'step 10').toEqual([]);
});

test('ders font floors at 1280x720', async ({ page }, info) => {
  await open(page, PAGE, 'ders', READY);
  const measured: Record<string, number | null> = {};
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    const m: Record<string, number[]> = {
      title: await fontSizes(page, '.step-title'),
      body: await fontSizes(page, '.step-text, .kitap-blok'),
      tick: await fontSizes(page, '.denetim, .terminal-satir, .data-table td, .data-table th, .code-trace-lines *, .kaynak-rozeti, .timeout-not, .uyari, svg.plot text:not(.probe)'),
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

for (const n of [7, 9]) {
  test(`screenshot: ders ${n}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, PAGE, 'ders', READY);
    await gotoStep(page, n - 1, STEPS, 0);
    await rest(page);
    await expect(page).toHaveScreenshot(`timeout-retry-ders-${n}.png`);
  });
}
