import { HttpCards } from '../../core/plot/http-cards';
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
 * The HTML beside (or under) the diagram: the shared request / response / terminal cards and, on the summary
 * step, the three-call table. `update` rebuilds their content from the view; the cards themselves persist.
 */
export class IstekCards {
  readonly root: HTMLDivElement;
  private readonly cards: HttpCards;
  private readonly tablo: HTMLDivElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'istek-cards');
    this.tablo = el(doc, 'div', 'ozet-host');
    this.root.append(this.tablo);
    this.cards = new HttpCards(this.root);
    host.append(this.root);
  }

  destroy(): void {
    this.cards.destroy();
    this.root.remove();
  }

  update(v: IstekView): void {
    const doc = this.root.ownerDocument;
    // the summary step lists the calls in the table; only the terminal stays
    const kartlar = v.ozet === null;
    const i = v.istekKarti;
    this.cards.update({
      ...(kartlar && i
        ? { istek: { metot: 'GET' as const, yol: i.yol, basliklar: [['kullaniciAdi', i.kullaniciAdi], ['yetkiliMi', String(i.yetkiliMi)]] as [string, string][] } }
        : {}),
      yanitlar: kartlar && v.yanit ? [{ durumKodu: v.yanit.durumKodu, govde: v.yanit.mesaj }] : [],
      terminal: v.terminal.map((metin) => ({ metin })),
    });
    this.renderTablo(doc, v);
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
