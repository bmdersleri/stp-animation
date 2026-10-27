import { HttpCards } from '../../core/plot/http-cards';
import type { MwView } from './view';

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Title of the box that shows the corrected program's output beside the hanging run. */
export const KARSILASTIRMA_BASLIK = 'code_011 · next çağrılır';

/**
 * The HTML beside (or under) the diagram: the shared request / response / terminal cards, the summary table on
 * the last step and, on the next-less step, the output of the corrected program. `update` rebuilds the content
 * from the view; the cards themselves persist.
 */
export class MwCards {
  readonly root: HTMLDivElement;
  private readonly cards: HttpCards;
  private readonly tablo: HTMLDivElement;
  private readonly karsilastirma: HTMLDivElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'mw-cards');
    this.tablo = el(doc, 'div', 'ozet-host');
    this.root.append(this.tablo);
    this.cards = new HttpCards(this.root);
    this.karsilastirma = el(doc, 'div', 'karsilastirma');
    this.root.append(this.karsilastirma);
    host.append(this.root);
  }

  destroy(): void {
    this.cards.destroy();
    this.root.remove();
  }

  update(v: MwView): void {
    const doc = this.root.ownerDocument;
    // the summary step lists the layers in the table; only the terminal stays
    const kartlar = v.ozet === null;
    this.cards.update(kartlar ? v.http : { yanitlar: [], terminal: v.http.terminal });
    this.renderTablo(doc, v);
    this.renderKarsilastirma(doc, v);
  }

  private renderTablo(doc: Document, v: MwView): void {
    this.tablo.hidden = v.ozet === null;
    if (!v.ozet) {
      this.tablo.replaceChildren();
      return;
    }
    const t = el(doc, 'table', 'ozet-tablosu');
    const head = doc.createElement('tr');
    for (const h of ['Katman', 'Ne yapar', 'Sonuç']) head.append(el(doc, 'th', '', h));
    const thead = doc.createElement('thead');
    thead.append(head);
    const tbody = doc.createElement('tbody');
    for (const r of v.ozet) {
      const tr = doc.createElement('tr');
      tr.append(el(doc, 'td', 'katman', r.katman), el(doc, 'td', '', r.ne), el(doc, 'td', '', r.sonuc));
      tbody.append(tr);
    }
    t.append(thead, tbody);
    this.tablo.replaceChildren(t);
  }

  private renderKarsilastirma(doc: Document, v: MwView): void {
    this.karsilastirma.hidden = v.karsilastirma === null;
    if (!v.karsilastirma) {
      this.karsilastirma.replaceChildren();
      return;
    }
    this.karsilastirma.replaceChildren(
      el(doc, 'div', 'kart-baslik', KARSILASTIRMA_BASLIK),
      ...v.karsilastirma.map((l) => el(doc, 'p', 'terminal-satir karsilastirma-satir', l)),
    );
  }
}
