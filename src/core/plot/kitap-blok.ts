import { DataTable, type DataTableSpec } from './data-table';
import './kitap-blok.css';

/** The book's own text on an intro or summary step, verbatim without code ticks and bold marks. */
export interface KitapBlok {
  /** The definition paragraph, shown after a bold "Tanım. " (the book's own label). */
  tanim?: string;
  /** Further book paragraphs, shown after the definition. */
  paragraflar?: readonly string[];
  tablolar: readonly DataTableSpec[];
  /** Further book sentences, shown muted under the rest. */
  notlar: readonly string[];
}

/** Renders a `KitapBlok`: the definition, paragraphs, tables, then the muted notes. Showing and hiding is the page's job. */
export class KitapBlokView {
  readonly root: HTMLDivElement;
  private tablolar: DataTable[] = [];

  constructor(host: HTMLElement) {
    this.root = host.ownerDocument.createElement('div');
    this.root.className = 'kitap-blok';
    host.append(this.root);
  }

  update(blok: KitapBlok | null): void {
    this.tablolar.splice(0).forEach((t) => t.destroy());
    this.root.replaceChildren();
    if (!blok) return;
    const doc = this.root.ownerDocument;
    const p = (cls: string, text: string): HTMLParagraphElement => {
      const e = doc.createElement('p');
      e.className = cls;
      e.textContent = text;
      return e;
    };
    if (blok.tanim) {
      const para = doc.createElement('p');
      para.className = 'tanim-metin';
      const strong = doc.createElement('strong');
      strong.textContent = 'Tanım. ';
      para.append(strong, blok.tanim);
      this.root.append(para);
    }
    for (const t of blok.paragraflar ?? []) this.root.append(p('kitap-paragraf', t));
    for (const spec of blok.tablolar) {
      const t = new DataTable(this.root);
      t.update(spec);
      this.tablolar.push(t);
    }
    for (const n of blok.notlar) this.root.append(p('kitap-not', n));
  }

  destroy(): void {
    this.tablolar.splice(0).forEach((t) => t.destroy());
    this.root.remove();
  }
}
