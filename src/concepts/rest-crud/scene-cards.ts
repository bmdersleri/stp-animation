import { DataTable } from '../../core/plot/data-table';
import { HttpCards, type HttpYanit } from '../../core/plot/http-cards';
import { sourceBadge } from '../../core/plot/source-badge';
import type { ProgramId } from './api';
import type { RestView } from './view';

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Label of the small note above the request card. */
export const ESLEME_ETIKETI = 'HTTP eşlemesi';
const OZET_BASLIK = ['Metot', 'Güvenli', 'Idempotent', 'Aynı istek tekrar gönderilirse'];
/** Response bodies longer than this many lines are left to the terminal (Lab program only). */
const UZUN_GOVDE = 6;

/**
 * The HTML beside (or under) the diagram: the route-mapping note, the request / response / terminal cards, the data
 * table and, on the summary step, the method table with the success-code list. The four blocks keep their order but
 * split into two columns where the heights balance best; `update` rebuilds the content from the view.
 */
export class RestCards {
  readonly root: HTMLDivElement;
  private readonly eslem: HTMLDivElement;
  private readonly cards: HttpCards;
  private readonly kolA: HTMLDivElement;
  private readonly kolB: HTMLDivElement;
  private readonly tabloYeri: HTMLDivElement;
  private readonly table: DataTable;
  private readonly ozet: HTMLDivElement;
  /** Request card, response card, terminal and table, in reading order. */
  private readonly bloklar: HTMLElement[];

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'rest-cards');
    this.eslem = el(doc, 'div', 'eslem');
    this.eslem.append(el(doc, 'span', 'eslem-etiket', ESLEME_ETIKETI), this.eslemRozeti(doc));
    this.kolA = el(doc, 'div', 'kol kol-a');
    this.kolB = el(doc, 'div', 'kol kol-b');
    // the shared cards are built in a detached holder: their three cards are placed into the columns one by one
    this.cards = new HttpCards(el(doc, 'div', 'kart-tutucu'));
    this.tabloYeri = el(doc, 'div', 'tablo-yeri');
    this.table = new DataTable(this.tabloYeri);
    const kart = (cls: string): HTMLElement => this.cards.root.querySelector<HTMLElement>(cls)!;
    this.bloklar = [kart('.istek-karti'), kart('.yanit-karti'), kart('.terminal'), this.tabloYeri];
    this.kolA.append(...this.bloklar);
    this.ozet = el(doc, 'div', 'ozet-host');
    this.root.append(this.eslem, this.kolA, this.kolB, this.ozet);
    host.append(this.root);
  }

  private eslemRozeti(doc: Document): HTMLSpanElement {
    const b = sourceBadge(doc, 'kitaba-dayali', 'Şekil 6.5');
    b.classList.add('eslem-rozeti');
    return b;
  }

  destroy(): void {
    this.cards.destroy();
    this.root.remove();
  }

  /** Height (px) the cards take along the bottom of the stage in the medium layout (terminal and table row, or the summary tables). */
  bottomHeight(): number {
    const h = (e: HTMLElement): number => (e.hidden || e.childElementCount === 0 ? 0 : e.getBoundingClientRect().height);
    return Math.max(h(this.kolB), h(this.ozet));
  }

  update(v: RestView, program: ProgramId, medium: boolean): void {
    const doc = this.root.ownerDocument;
    this.eslem.hidden = !v.http.istek;
    const { yanitlar, govdeTerminalde } = this.yanitlar(v, program);
    this.cards.update({ ...v.http, yanitlar });
    if (govdeTerminalde) this.bloklar[1].append(el(doc, 'p', 'govde-not', 'Gövde: terminalde'));
    this.tabloYeri.hidden = v.tablo === null;
    if (v.tablo) this.table.update(v.tablo);
    this.renderOzet(doc, v);
    if (medium) this.sabit();
    else this.bol();
  }

  /** Medium layout: request and response beside the diagram, terminal and table in a row under both. */
  private sabit(): void {
    this.kolA.append(this.bloklar[0], this.bloklar[1]);
    this.kolB.append(this.bloklar[2], this.bloklar[3]);
  }

  /**
   * Puts each block into one of the two columns (reading order kept inside a column) so that the taller column is as
   * short as possible; where layout is unavailable the first two blocks go left, the rest right.
   */
  private bol(): void {
    this.kolA.append(...this.bloklar);
    const h = this.bloklar.map((b) => (b.hidden ? 0 : b.getBoundingClientRect().height));
    let enMaske = 0b0011;
    let enIyi = Infinity;
    // the request card always stays in the first column: the response never sits left of it
    for (let mask = 1; mask < 1 << h.length; mask += 2) {
      let a = 0;
      let b = 0;
      h.forEach((x, i) => ((mask >> i) & 1 ? (a += x) : (b += x)));
      if (Math.max(a, b) < enIyi - 0.5) {
        enIyi = Math.max(a, b);
        enMaske = mask;
      }
    }
    if (h.every((x) => x === 0)) enMaske = 0b0011;
    this.kolB.append(...this.bloklar.filter((_, i) => !((enMaske >> i) & 1)));
  }

  /**
   * The responses the card lists. The Lab program's earlier sends are setup for the shown one, so only repeats of the
   * same request stay; the book's repeat program lists every send. Earlier responses shrink to their status line, and
   * the Lab program's long body is left to the terminal that prints the same object.
   */
  private yanitlar(v: RestView, program: ProgramId): { yanitlar: HttpYanit[]; govdeTerminalde: boolean } {
    const hepsi = v.http.yanitlar;
    const son = hepsi[hepsi.length - 1];
    if (!son) return { yanitlar: [], govdeTerminalde: false };
    const sonId = v.sira[(son.sira ?? 1) - 1];
    const secilen = hepsi.filter((y) => program === 'idempotentlik' || v.sira[(y.sira ?? 1) - 1] === sonId);
    let elendi = false;
    const yanitlar = secilen.map((y, i): HttpYanit => {
      const sira = secilen.length > 1 ? { sira: i + 1 } : {};
      if (i < secilen.length - 1) return { durumKodu: y.durumKodu, durumMetni: y.durumMetni, ...sira };
      if (program === 'laboratuvar-api' && (y.govde ?? '').split('\n').length > UZUN_GOVDE) {
        elendi = true;
        return { durumKodu: y.durumKodu, durumMetni: y.durumMetni, basliklar: y.basliklar, ...sira };
      }
      const { sira: _eski, ...gerisi } = y;
      return { ...gerisi, ...sira };
    });
    return { yanitlar, govdeTerminalde: elendi };
  }

  private renderOzet(doc: Document, v: RestView): void {
    this.ozet.hidden = v.ozet === null;
    if (!v.ozet) {
      this.ozet.replaceChildren();
      return;
    }
    const t = el(doc, 'table', 'ozet-tablosu');
    const head = doc.createElement('tr');
    for (const h of OZET_BASLIK) head.append(el(doc, 'th', '', h));
    const thead = doc.createElement('thead');
    thead.append(head);
    const tbody = doc.createElement('tbody');
    for (const r of v.ozet.metotlar) {
      const tr = doc.createElement('tr');
      r.forEach((c, i) => tr.append(el(doc, 'td', i === 0 ? 'katman' : '', c)));
      tbody.append(tr);
    }
    t.append(thead, tbody);
    const liste = el(doc, 'ul', 'uc-noktalari');
    for (const s of v.ozet.basarilar) liste.append(el(doc, 'li', '', s));
    this.ozet.replaceChildren(t, liste);
  }
}
