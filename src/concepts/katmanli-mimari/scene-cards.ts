import { balanceColumns } from '../../core/plot/columns';
import { DataTable } from '../../core/plot/data-table';
import { HttpCards } from '../../core/plot/http-cards';
import type { KatmanView } from './view';

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  e.className = cls;
  return e;
}

/**
 * The HTML beside (or under) the diagram: response card, terminal and the two data tables, split into two columns
 * where the heights balance best; on the life-cycle and summary steps one large table replaces all four.
 */
export class KatmanCards {
  readonly root: HTMLDivElement;
  private readonly cards: HttpCards;
  private readonly kolA: HTMLDivElement;
  private readonly kolB: HTMLDivElement;
  private readonly tabloKitaplar: HTMLDivElement;
  private readonly tabloOgrenciler: HTMLDivElement;
  private readonly tabloBuyuk: HTMLDivElement;
  private readonly kitaplar: DataTable;
  private readonly ogrenciler: DataTable;
  private readonly buyuk: DataTable;
  /** Response card, terminal, books table and students table, in reading order. */
  private readonly bloklar: HTMLElement[];

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'katman-cards');
    this.kolA = el(doc, 'div', 'kol kol-a');
    this.kolB = el(doc, 'div', 'kol kol-b');
    // the shared cards are built in a detached holder: the response card and terminal are placed into the columns one by one
    this.cards = new HttpCards(el(doc, 'div', 'kart-tutucu'));
    this.tabloKitaplar = el(doc, 'div', 'tablo-yeri tablo-kitaplar');
    this.tabloOgrenciler = el(doc, 'div', 'tablo-yeri tablo-ogrenciler');
    this.kitaplar = new DataTable(this.tabloKitaplar);
    this.ogrenciler = new DataTable(this.tabloOgrenciler);
    this.tabloBuyuk = el(doc, 'div', 'tablo-yeri tablo-buyuk');
    this.buyuk = new DataTable(this.tabloBuyuk);
    const kart = (cls: string): HTMLElement => this.cards.root.querySelector<HTMLElement>(cls)!;
    this.bloklar = [kart('.yanit-karti'), kart('.terminal'), this.tabloKitaplar, this.tabloOgrenciler];
    this.kolA.append(...this.bloklar);
    this.root.append(this.kolA, this.kolB, this.tabloBuyuk);
    host.append(this.root);
  }

  destroy(): void {
    this.cards.destroy();
    this.root.remove();
  }

  /** Height (px) the second column takes along the bottom of the stage in the medium layout. */
  bottomHeight(): number {
    const e = this.kolB;
    return e.hidden || e.childElementCount === 0 ? 0 : e.getBoundingClientRect().height;
  }

  update(v: KatmanView, medium: boolean): void {
    const buyukSpec = v.yasam ?? v.ozet;
    this.cards.update(buyukSpec ? { yanitlar: [], terminal: [] } : v.http);
    this.kolA.hidden = buyukSpec !== null;
    this.kolB.hidden = buyukSpec !== null;
    this.tabloBuyuk.hidden = buyukSpec === null;
    this.tabloKitaplar.hidden = buyukSpec !== null;
    this.tabloOgrenciler.hidden = buyukSpec !== null;
    if (buyukSpec) {
      this.buyuk.update(buyukSpec);
      return;
    }
    this.kitaplar.update(v.kitaplar);
    this.ogrenciler.update(v.ogrenciler);
    if (medium) {
      this.kolA.append(this.bloklar[0], this.bloklar[1]);
      this.kolB.append(this.bloklar[2], this.bloklar[3]);
    } else {
      balanceColumns(this.bloklar, this.kolA, this.kolB);
    }
  }
}
