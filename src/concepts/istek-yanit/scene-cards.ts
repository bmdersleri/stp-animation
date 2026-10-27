import type { IstekView } from './view';
import { LANES } from './view';

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const layerLabel = (id: string): string => LANES.find((l) => l.id === id)?.label.join(' ') ?? id;

/**
 * The HTML cards beside (or under) the diagram: request card, response card, terminal and, on the summary
 * step, the three-call table. `update` rebuilds their content from the view; the cards themselves persist.
 */
export class IstekCards {
  readonly root: HTMLDivElement;
  private readonly istek: HTMLDivElement;
  private readonly yanit: HTMLDivElement;
  private readonly terminal: HTMLDivElement;
  private readonly tablo: HTMLDivElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'istek-cards');
    this.tablo = el(doc, 'div', 'ozet-host');
    this.istek = el(doc, 'div', 'istek-karti');
    this.yanit = el(doc, 'div', 'yanit-karti');
    this.terminal = el(doc, 'div', 'terminal');
    this.root.append(this.tablo, this.istek, this.yanit, this.terminal);
    host.append(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  update(v: IstekView): void {
    const doc = this.root.ownerDocument;
    this.renderIstek(doc, v);
    this.renderYanit(doc, v);
    this.renderTablo(doc, v);
    const lines = v.terminal.map((t) => el(doc, 'p', 'terminal-satir', t));
    this.terminal.replaceChildren(el(doc, 'div', 'kart-baslik', 'Terminal'), ...lines);
    this.terminal.hidden = lines.length === 0;
  }

  private renderIstek(doc: Document, v: IstekView): void {
    const ozet = v.ozet !== null;
    this.istek.hidden = ozet || !v.istekKarti;
    if (ozet || !v.istekKarti) {
      this.istek.replaceChildren();
      return;
    }
    const i = v.istekKarti;
    const satir = el(doc, 'p', 'istek-satir');
    satir.append(el(doc, 'span', 'metot', 'GET'), ' ', el(doc, 'code', 'yol', i.yol));
    const dl = el(doc, 'dl', 'alanlar');
    for (const [k, val] of [['kullaniciAdi', i.kullaniciAdi], ['yetkiliMi', String(i.yetkiliMi)]]) {
      dl.append(el(doc, 'dt', '', k), el(doc, 'dd', '', val));
    }
    this.istek.replaceChildren(el(doc, 'div', 'kart-baslik', 'İstek'), satir, dl);
  }

  private renderYanit(doc: Document, v: IstekView): void {
    const hide = v.ozet !== null || !v.yanit;
    this.yanit.hidden = hide;
    if (hide || !v.yanit) {
      this.yanit.replaceChildren();
      return;
    }
    const y = v.yanit;
    const rozet = el(doc, 'span', `durum-kodu ${y.durumKodu === 200 ? 'ok' : 'alarm'}`, String(y.durumKodu));
    this.yanit.replaceChildren(el(doc, 'div', 'kart-baslik', 'Yanıt'), rozet, el(doc, 'p', 'mesaj', y.mesaj));
  }

  private renderTablo(doc: Document, v: IstekView): void {
    this.tablo.hidden = v.ozet === null;
    if (!v.ozet) {
      this.tablo.replaceChildren();
      return;
    }
    const t = el(doc, 'table', 'ozet-tablosu');
    const head = doc.createElement('tr');
    for (const h of ['Yol', 'Yetki', 'Durduran katman', 'Kod', 'Mesaj']) head.append(el(doc, 'th', '', h));
    const thead = doc.createElement('thead');
    thead.append(head);
    const tbody = doc.createElement('tbody');
    for (const r of v.ozet) {
      const tr = doc.createElement('tr');
      const kod = el(doc, 'td', r.yanit.durumKodu === 200 ? 'ok' : 'alarm', String(r.yanit.durumKodu));
      tr.append(
        el(doc, 'td', 'yol', r.yol),
        el(doc, 'td', '', r.yetkiliMi ? 'Evet' : 'Hayır'),
        el(doc, 'td', '', layerLabel(r.durduran)),
        kod,
        el(doc, 'td', '', r.yanit.mesaj),
      );
      tbody.append(tr);
    }
    t.append(thead, tbody);
    this.tablo.replaceChildren(t);
  }
}
