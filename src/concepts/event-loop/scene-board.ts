import { framesOf } from './programs';
import type { LoopView } from './view';

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

type BoxId = 'yigin' | 'zamanlayici' | 'mikro' | 'makro';

interface Entry {
  box: BoxId;
  label: string;
  /** Timers only: ms left on the clock. */
  remaining?: number;
}

/** Longest wait (ms) any timer of the program ever has, so the remaining-time bars share one scale. */
const waits = new Map<string, number>();
const longestWait = (view: LoopView): number => {
  let w = waits.get(view.program.id);
  if (w === undefined) {
    w = Math.max(1, ...framesOf(view.program.id).flatMap((f) => f.timers.map((t) => t.dueAt - f.clock)));
    waits.set(view.program.id, w);
  }
  return w;
};

/**
 * The HTML board of the event-loop page: clock, call stack, libuv timers, micro and macro queues, terminal and
 * notes. Items are keyed by their label (plus an occurrence number for repeated labels), so a callback that
 * moves from one box to the next is the same element: it slides there (FLIP) instead of being re-created.
 */
export class LoopBoard {
  readonly root: HTMLDivElement;
  private readonly saat: HTMLDivElement;
  private readonly lists = {} as Record<BoxId, HTMLDivElement>;
  private readonly terminal: HTMLDivElement;
  private readonly terminalLines: HTMLDivElement;
  private readonly kitap: HTMLDivElement;
  private readonly notes: HTMLDivElement;
  private readonly items = new Map<string, HTMLDivElement>();

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'tahta');
    this.saat = el(doc, 'div', 'saat');
    const box = (id: BoxId, cls: string, title: string): HTMLDivElement => {
      const b = el(doc, 'div', `kutu ${cls}`);
      const list = el(doc, 'div', 'kutu-liste');
      b.append(el(doc, 'div', 'kart-baslik', title), list);
      this.root.append(b);
      this.lists[id] = list;
      return b;
    };
    this.root.append(this.saat);
    box('yigin', 'kutu-yigin', 'Ana çağrı yığını');
    box('zamanlayici', 'kutu-zamanlayici', 'Zamanlayıcılar (libuv)');
    box('mikro', 'kutu-mikro', 'Mikro görev kuyruğu (Promise)');
    box('makro', 'kutu-makro', 'Makro görev kuyruğu (zamanlayıcı)');
    this.terminal = el(doc, 'div', 'terminal');
    this.terminalLines = el(doc, 'div', 'terminal-satirlar');
    this.terminal.append(el(doc, 'div', 'kart-baslik', 'Terminal'), this.terminalLines);
    const notlar = el(doc, 'div', 'notlar');
    this.kitap = el(doc, 'div', 'kitap-notu');
    this.notes = el(doc, 'div', 'not-liste');
    notlar.append(this.kitap, this.notes);
    this.root.append(this.terminal, notlar);
    host.append(this.root);
  }

  destroy(): void {
    this.items.clear();
    this.root.remove();
  }

  /** Redraws the board for `v`; with `flipMs` > 0 items that changed box slide from their old place. */
  update(v: LoopView, flipMs: number): void {
    const f = v.frame;
    this.saat.textContent = `t = ${f.clock} ms`;
    const scale = longestWait(v);
    const entries: Entry[] = [
      ...f.stack.map((label): Entry => ({ box: 'yigin', label })),
      ...f.timers.map((t): Entry => ({ box: 'zamanlayici', label: t.label, remaining: Math.max(0, t.dueAt - f.clock) })),
      ...f.micro.map((label): Entry => ({ box: 'mikro', label })),
      ...f.macro.map((label): Entry => ({ box: 'makro', label })),
    ];

    const before = new Map<string, DOMRect>();
    if (flipMs > 0) {
      for (const [k, e] of this.items) before.set(k, e.getBoundingClientRect());
      // a slide still running is measured where it is, then stopped: the next one starts from there
      for (const e of this.items.values()) e.getAnimations?.().forEach((an) => an.cancel());
    }

    const seen = new Map<string, number>();
    const keep = new Set<string>();
    const order: Record<BoxId, HTMLDivElement[]> = { yigin: [], zamanlayici: [], mikro: [], makro: [] };
    const doc = this.root.ownerDocument;
    for (const e of entries) {
      const n = seen.get(e.label) ?? 0;
      seen.set(e.label, n + 1);
      const key = `${e.label}#${n}`;
      keep.add(key);
      let item = this.items.get(key);
      if (!item) {
        item = el(doc, 'div', 'is');
        this.items.set(key, item);
      }
      this.fill(item, e, scale);
      order[e.box].push(item);
    }
    for (const [k, item] of this.items) {
      if (!keep.has(k)) {
        item.remove();
        this.items.delete(k);
      }
    }
    for (const id of Object.keys(order) as BoxId[]) {
      this.lists[id].replaceChildren(...order[id]);
      this.lists[id].toggleAttribute('data-empty', order[id].length === 0);
    }

    if (flipMs > 0) {
      for (const [k, item] of this.items) {
        const b = before.get(k);
        if (!b || typeof item.animate !== 'function') continue;
        const a = item.getBoundingClientRect();
        const dx = b.left - a.left;
        const dy = b.top - a.top;
        if (dx === 0 && dy === 0) continue;
        item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: flipMs, easing: 'ease-out' });
      }
    }

    this.syncLines(this.terminalLines, f.output, 'terminal-satir');
    this.kitap.hidden = v.bookNote === null;
    this.kitap.textContent = v.bookNote ?? '';
    this.syncLines(this.notes, v.notes, 'not');
  }

  private fill(item: HTMLDivElement, e: Entry, scale: number): void {
    const doc = item.ownerDocument;
    if (e.remaining === undefined) {
      item.replaceChildren(el(doc, 'span', 'is-ad', e.label));
      return;
    }
    const bar = el(doc, 'div', 'sure-cubuk');
    const fill = el(doc, 'i', 'sure-dolu');
    fill.style.width = `${Math.round((e.remaining / scale) * 100)}%`;
    bar.append(fill);
    item.replaceChildren(el(doc, 'span', 'is-ad', e.label), el(doc, 'span', 'kalan', `kalan ${e.remaining} ms`), bar);
  }

  /** Keeps one `<p>` per text, re-using the elements that are already there. */
  private syncLines(host: HTMLElement, lines: readonly string[], cls: string): void {
    const doc = host.ownerDocument;
    while (host.children.length > lines.length) host.lastElementChild!.remove();
    lines.forEach((t, i) => {
      let p = host.children[i] as HTMLElement | undefined;
      if (!p) {
        p = el(doc, 'p', cls);
        host.append(p);
      }
      if (p.textContent !== t) p.textContent = t;
    });
  }
}
