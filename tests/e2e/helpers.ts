import { expect, type Page } from '@playwright/test';

export const stepCount = (page: Page) => page.locator('.step-count');

/** Jump to a step by its dot (index 0-based) and let the transitions settle. */
export async function gotoStep(page: Page, index: number, count: number, settleMs = 1500): Promise<void> {
  await page.locator('.step-dot').nth(index).click();
  await expect(stepCount(page)).toHaveText(`Adım ${index + 1} / ${count}`);
  await page.waitForTimeout(settleMs);
}

/** Open a page in a mode; `ready` is a selector that shows the scene is ready. */
export async function open(page: Page, path: string, mode: 'ders' | 'lab', ready: string): Promise<void> {
  await page.goto(`${path}?mod=${mode}`);
  await expect(page.locator(`[data-mode="${mode}"]`).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(ready).first()).toBeAttached();
}

/** Computed font sizes (px) of every rendered, visible element matching the selector. */
export function fontSizes(page: Page, selector: string): Promise<number[]> {
  return page.evaluate((sel) => {
    const out: number[] = [];
    for (const el of document.querySelectorAll<Element>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if ((el as HTMLElement).closest('[hidden]')) continue;
      out.push(parseFloat(cs.fontSize));
    }
    return out;
  }, selector);
}

export function p95(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
}

export const round = (x: number): number => Math.round(x * 100) / 100;

/** How far the document root overflows the viewport (≤ 0 means no scroll). */
export function pageOverflow(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
}

/** Visible matches whose box sticks out of the `.stage` box by more than 1 px (class + text). */
export function outsideStage(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const s = document.querySelector('.stage')!.getBoundingClientRect();
    const out: string[] = [];
    for (const el of document.querySelectorAll<Element>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[hidden]') || cs.opacity === '0') continue;
      if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) {
        out.push(`${el.getAttribute('class') ?? el.tagName} "${(el.textContent ?? '').trim().slice(0, 40)}"`);
      }
    }
    return out;
  }, selector);
}

/**
 * Scene boxes that hide part of their content (class + reason): a visible match that sticks out of the `.stage`
 * box, scrolls sideways, or scrolls down. A box that matches `scrollers` is meant to scroll down: its content must
 * then stay reachable through its own scrollbar (computed `overflow-y` auto or scroll) instead.
 */
export function clippedBoxes(page: Page, selector: string, scrollers = ''): Promise<string[]> {
  return page.evaluate(([sel, scroll]) => {
    const s = document.querySelector('.stage')!.getBoundingClientRect();
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.display === 'none' || el.closest('[hidden]')) continue;
      const name = el.getAttribute('class') ?? el.tagName;
      if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) out.push(`${name}: outside the stage`);
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${name}: scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`);
      if (el.scrollHeight > el.clientHeight + 1) {
        const meant = scroll !== '' && el.matches(scroll);
        if (!meant) out.push(`${name}: scrolls down (${el.scrollHeight} > ${el.clientHeight})`);
        else if (!['auto', 'scroll'].includes(cs.overflowY)) out.push(`${name}: content below the box is unreachable`);
      }
    }
    return out;
  }, [selector, scrollers] as const);
}

/**
 * Under the diagram (phone width) the stage scrolls on purpose, so the cards and the lower part of a tall diagram
 * stick out of its box. For each such box (name returned) its nearest scrollable ancestor must contain it in its
 * scroll range, and that ancestor must itself sit inside the stage; the names of boxes that pass are `reachable`,
 * those that do not are `lost`.
 */
export function scrollReach(page: Page, sel: string): Promise<{ reachable: string[]; lost: string[] }> {
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

/**
 * Visible containers matching `sel` that scroll internally or are cut by the `stage` box (a page's own scene
 * stage, e.g. `.rest-stage`). `display: contents` wrappers are skipped, their children are checked instead.
 */
export function stageBoxProblems(page: Page, stage: string, sel: string): Promise<string[]> {
  return page.evaluate(([stage, sel]) => {
    const st = document.querySelector<HTMLElement>(stage)!.getBoundingClientRect();
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.display === 'contents' || el.closest('[hidden]') || cs.display === 'none' || r.width === 0 || r.height === 0) continue;
      const name = el.className;
      if (el.scrollHeight - el.clientHeight > 1) out.push(`${name}: scrolls ${el.scrollHeight - el.clientHeight}`);
      if (r.top < st.top - 1 || r.bottom > st.bottom + 1 || r.left < st.left - 1 || r.right > st.right + 1) out.push(`${name}: outside the stage`);
    }
    return out;
  }, [stage, sel] as const);
}

/**
 * Book notes the shown source badge cites but the reader cannot see. A book note carries its book line in
 * `data-kitap-satir`; the badge's ref (`L398, L433-435`) is read from `.rozet-yeri .kaynak-rozeti`. A cited note must
 * be shown, must not scroll inside and must lie inside the `stage` box. `satirlar` are the lines the step must show:
 * a missing one is a problem too. Returns `L<line>: <reason>`.
 */
export function citedNoteProblems(page: Page, stage: string, satirlar: readonly number[]): Promise<string[]> {
  return page.evaluate(([stage, satirlar]) => {
    const ref = document.querySelector('.rozet-yeri .kaynak-rozeti')?.textContent ?? '';
    const cites = (n: number): boolean => [...ref.matchAll(/\bL(\d+)(?:-(\d+))?/g)].some((m) => n >= Number(m[1]) && n <= Number(m[2] ?? m[1]));
    const st = document.querySelector<HTMLElement>(stage)!.getBoundingClientRect();
    const out: string[] = [];
    const notlar = [...document.querySelectorAll<HTMLElement>('[data-kitap-satir]')];
    for (const n of satirlar) {
      if (!cites(n)) out.push(`L${n}: not cited by the badge "${ref}"`);
      if (!notlar.some((el) => Number(el.dataset.kitapSatir) === n)) out.push(`L${n}: no note on the page`);
    }
    for (const el of notlar) {
      const n = Number(el.dataset.kitapSatir);
      if (!cites(n)) continue;
      const r = el.getBoundingClientRect();
      if (el.closest('[hidden]') || getComputedStyle(el).display === 'none' || r.width === 0 || r.height === 0) { out.push(`L${n}: hidden`); continue; }
      if (el.scrollHeight - el.clientHeight > 1) out.push(`L${n}: scrolls ${el.scrollHeight - el.clientHeight}`);
      if (r.top < st.top - 1 || r.bottom > st.bottom + 1 || r.left < st.left - 1 || r.right > st.right + 1) out.push(`L${n}: outside the stage`);
    }
    return out;
  }, [stage, satirlar] as const);
}

/**
 * Sequence-diagram parts that the diagram's own `<svg>` clips (it has `overflow: hidden`): every visible
 * (non-`old`) message row — arrow, label, note box — the stop mark, the token and the lane titles must lie inside
 * the bounding box of the svg that holds them. Checking against `.stage` is not enough, since the stage also covers
 * the cards and the code strip.
 */
export function seqOutsideSvg(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const svg of document.querySelectorAll<SVGSVGElement>('svg.plot')) {
      if (!svg.querySelector('.seq-lane') || svg.closest('[hidden]')) continue;
      const s = svg.getBoundingClientRect();
      if (s.width === 0 || s.height === 0) continue;
      for (const el of svg.querySelectorAll<SVGGraphicsElement>('g.seq-msg:not(.old), g.seq-stop, circle.seq-token, .seq-lane text')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (getComputedStyle(el).display === 'none') continue;
        if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) {
          const id = el.closest('[data-id]')?.getAttribute('data-id') ?? '';
          out.push(`${el.getAttribute('class') ?? el.tagName}${id ? `[${id}]` : ''} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.top)}-${Math.round(r.bottom)} vs svg ${Math.round(s.top)}-${Math.round(s.bottom)}`);
        }
      }
    }
    return out;
  });
}

/**
 * A pair that stacks on purpose: an `upper` text directly above a `lower` text inside the same `within`
 * ancestor, whose line boxes may touch by at most `maxShare` of the smaller box height. Text on one
 * baseline (the same top) never matches, so a tag drawn over its count still counts as an overlap.
 */
export interface Stack {
  upper: string;
  lower: string;
  within: string;
  maxShare: number;
}

/** Intersecting pairs among the visible matches (class + text of both); `stacks` names pairs that touch on purpose. */
export function overlaps(page: Page, selector: string, stacks: Stack[] = []): Promise<string[]> {
  return page.evaluate(([sel, rules]) => {
    const items: { el: Element; name: string; r: DOMRect }[] = [];
    for (const el of document.querySelectorAll<Element>(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[hidden]') || cs.opacity === '0') continue;
      items.push({ el, name: `${el.getAttribute('class') ?? el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}"`, r });
    }
    const stacked = (a: (typeof items)[number], b: (typeof items)[number], depth: number): boolean =>
      rules.some((s) => {
        const [up, low] = a.el.matches(s.upper) && b.el.matches(s.lower) ? [a, b] : b.el.matches(s.upper) && a.el.matches(s.lower) ? [b, a] : [null, null];
        if (!up || !low) return false;
        const box = up.el.closest(s.within);
        return box !== null && box === low.el.closest(s.within) && up.r.top < low.r.top - 0.5 && depth <= s.maxShare * Math.min(up.r.height, low.r.height);
      });
    const out: string[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].r;
        const b = items[j].r;
        const depth = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && depth > 0.5 && !stacked(items[i], items[j], depth)) {
          out.push(`${items[i].name} x ${items[j].name}`);
        }
      }
    }
    return out;
  }, [selector, stacks] as const);
}

/**
 * Lab params card: every visible enabled input/select must sit fully inside the
 * viewport and inside the visible box of `.side` without scrolling; returns the offenders.
 */
export function paramsOutside(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const side = document.querySelector('.side')!.getBoundingClientRect();
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.params input, .params select')) {
      if (el.disabled) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('[hidden]')) continue;
      const inView = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
      const inSide = r.left >= side.left - 0.5 && r.top >= side.top - 0.5 && r.right <= side.right + 0.5 && r.bottom <= side.bottom + 0.5;
      if (!inView || !inSide) out.push(`${el.getAttribute('name') ?? el.getAttribute('data-param')}=${el.getAttribute('value') ?? ''} bottom ${Math.round(r.bottom)} (side ${Math.round(side.bottom)})`);
    }
    return out;
  });
}

/** Lab params card: control groups (fieldsets / .ctl) whose controls are all disabled yet still displayed. */
export function shownDisabledGroups(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const g of document.querySelectorAll<HTMLElement>('.params .ctl')) {
      const ins = [...g.querySelectorAll<HTMLInputElement>('input, select')];
      if (ins.length === 0 || !ins.every((i) => i.disabled)) continue;
      const r = g.getBoundingClientRect();
      if (getComputedStyle(g).display !== 'none' && r.height > 0 && !g.closest('[hidden]')) {
        out.push(g.querySelector('legend, label')?.textContent ?? 'group');
      }
    }
    return out;
  });
}

/**
 * Scatter label collisions inside `svgSel`: a centre or point label that intersects another label
 * or any centre's plus marker (plus–plus contact between close centres is not text and is ignored).
 */
export function labelCollisions(page: Page, svgSel: string): Promise<string[]> {
  return page.evaluate((root) => {
    const svg = document.querySelector(root)!;
    const name = (e: Element): string => `${e.getAttribute('class')} "${(e.textContent ?? '').trim()}"`;
    const shown = (e: Element): boolean => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.closest('[hidden]');
    };
    const labels = [...svg.querySelectorAll('.cs-center-label, .cs-ring-label')].filter((e) => (e.textContent ?? '').trim() !== '' && shown(e));
    const pluses = [...svg.querySelectorAll('.cs-plus')].filter(shown);
    const hit = (a: DOMRect, b: DOMRect): boolean =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const out: string[] = [];
    labels.forEach((l, i) => {
      const r = l.getBoundingClientRect();
      for (const m of labels.slice(i + 1)) if (hit(r, m.getBoundingClientRect())) out.push(`${name(l)} x ${name(m)}`);
      pluses.forEach((p, j) => {
        if (hit(r, p.getBoundingClientRect())) out.push(`${name(l)} x plus M${j + 1}`);
      });
    });
    return out;
  }, svgSel);
}

/**
 * Wait until `read()` returns the same value on two consecutive polls (100 ms apart), i.e. the
 * animation or layout it reads has come to rest. Replaces a fixed `waitForTimeout`.
 */
export async function settled(read: () => Promise<unknown>, timeout = 10_000): Promise<void> {
  let last: string | undefined;
  await expect.poll(async () => {
    const now = JSON.stringify(await read());
    const same = now === last;
    last = now;
    return same;
  }, { intervals: [100], timeout }).toBe(true);
}
