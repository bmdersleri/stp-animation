import './http-cards.css';

export type Metot = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export interface HttpIstek {
  metot: Metot;
  yol: string;
  basliklar?: readonly [string, string][];
  /** Formatted JSON text. */
  govde?: string;
}
export interface HttpYanit {
  durumKodu: number;
  durumMetni?: string;
  basliklar?: readonly [string, string][];
  /** `null` shows "gövde yok". */
  govde?: string | null;
  /** The request never got an answer: the card shows no status. */
  askida?: boolean;
  /** Repeated sends: 1, 2, 3. */
  sira?: number;
}
export interface TerminalSatir {
  metin: string;
  akis?: 'stdout' | 'stderr';
}
export interface HttpCardsSpec {
  istek?: HttpIstek;
  yanitlar: readonly HttpYanit[];
  terminal: readonly TerminalSatir[];
  terminalBaslik?: string;
}

export const DURUM_METNI: Readonly<Record<number, string>> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  422: 'Unprocessable Content',
  500: 'Internal Server Error',
};

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function basliklar(doc: Document, list: readonly [string, string][] | undefined): HTMLElement | null {
  if (!list || list.length === 0) return null;
  const dl = el(doc, 'dl', 'alanlar');
  for (const [k, v] of list) dl.append(el(doc, 'dt', '', k), el(doc, 'dd', '', v));
  return dl;
}

/** A body text: one line is a paragraph (`p.govde.mesaj`), several lines (formatted JSON) a `pre.govde`. */
function govde(doc: Document, text: string, forcePre: boolean): HTMLElement {
  return forcePre || text.includes('\n') ? el(doc, 'pre', 'govde', text) : el(doc, 'p', 'govde mesaj', text);
}

/**
 * The HTML cards beside (or under) a diagram: request card, response card (one `.yanit` block per response) and
 * terminal. `update` rebuilds their content; the cards themselves persist and are `hidden` when empty.
 */
export class HttpCards {
  readonly root: HTMLDivElement;
  private readonly istek: HTMLDivElement;
  private readonly yanit: HTMLDivElement;
  private readonly terminal: HTMLDivElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'http-cards');
    this.istek = el(doc, 'div', 'istek-karti');
    this.yanit = el(doc, 'div', 'yanit-karti');
    this.terminal = el(doc, 'div', 'terminal');
    this.root.append(this.istek, this.yanit, this.terminal);
    host.append(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  update(spec: HttpCardsSpec): void {
    const doc = this.root.ownerDocument;
    this.renderIstek(doc, spec);
    this.renderYanit(doc, spec);
    const lines = spec.terminal.map((t) => el(doc, 'p', t.akis === 'stderr' ? 'terminal-satir stderr' : 'terminal-satir', t.metin));
    this.terminal.hidden = lines.length === 0;
    this.terminal.replaceChildren(...(lines.length > 0 ? [el(doc, 'div', 'kart-baslik', spec.terminalBaslik ?? 'Terminal'), ...lines] : []));
  }

  private renderIstek(doc: Document, spec: HttpCardsSpec): void {
    const i = spec.istek;
    this.istek.hidden = !i;
    if (!i) {
      this.istek.replaceChildren();
      return;
    }
    const satir = el(doc, 'p', 'istek-satir');
    satir.append(el(doc, 'span', `metot metot-${i.metot.toLowerCase()}`, i.metot), ' ', el(doc, 'code', 'yol', i.yol));
    const parts: (HTMLElement | null)[] = [el(doc, 'div', 'kart-baslik', 'İstek'), satir, basliklar(doc, i.basliklar)];
    if (i.govde !== undefined) parts.push(govde(doc, i.govde, true));
    this.istek.replaceChildren(...parts.filter((p): p is HTMLElement => p !== null));
  }

  private renderYanit(doc: Document, spec: HttpCardsSpec): void {
    this.yanit.hidden = spec.yanitlar.length === 0;
    const blocks = spec.yanitlar.map((y) => {
      const b = el(doc, 'div', 'yanit');
      if (y.askida) {
        b.append(el(doc, 'p', 'yanit-yok', 'yanıt yok — istemci bekliyor'));
        return b;
      }
      const ust = el(doc, 'div', 'yanit-ust');
      ust.append(el(doc, 'span', `durum-kodu ${y.durumKodu >= 200 && y.durumKodu < 300 ? 'ok' : 'alarm'}`, String(y.durumKodu)));
      if (y.durumMetni) ust.append(' ', el(doc, 'span', 'durum-metni', y.durumMetni));
      if (y.sira !== undefined) ust.append(' ', el(doc, 'span', 'sira', `#${y.sira}`));
      b.append(ust);
      const bl = basliklar(doc, y.basliklar);
      if (bl) b.append(bl);
      if (y.govde === null) b.append(el(doc, 'p', 'govde-yok', 'gövde yok'));
      else if (y.govde !== undefined) b.append(govde(doc, y.govde, false));
      return b;
    });
    this.yanit.replaceChildren(...(blocks.length > 0 ? [el(doc, 'div', 'kart-baslik', 'Yanıt'), ...blocks] : []));
  }
}
