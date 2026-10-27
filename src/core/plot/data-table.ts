import './data-table.css';

export type Hucre = string | number | boolean | null;
export type SatirDurumu = 'yeni' | 'degisti' | 'silindi' | 'eslesti' | 'eslesmedi' | 'etkin' | 'soluk';
export interface TabloSatiri {
  key: string;
  cells: readonly Hucre[];
  state?: SatirDurumu;
  changed?: readonly number[];
}
export interface Sutun {
  ad: string;
  anahtar?: 'PK' | 'FK';
}
export interface DataTableSpec {
  baslik: string;
  sutunlar: readonly Sutun[];
  satirlar: readonly TabloSatiri[];
  not?: string;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * A titled `<table>` (`.data-table` > `.data-table-title` + `table` + optional `p.data-table-not`). Rows are keyed:
 * `update` reuses the `tr` of a known key and removes the ones the new spec lacks. A deleted row is passed with
 * `state: 'silindi'` by the caller; it stays (struck through) until the next spec leaves it out.
 */
export class DataTable {
  readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly thead: HTMLTableSectionElement;
  private readonly tbody: HTMLTableSectionElement;
  private note: HTMLParagraphElement | null = null;
  private readonly rows = new Map<string, HTMLTableRowElement>();

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'data-table');
    this.title = el(doc, 'div', 'data-table-title');
    const table = el(doc, 'table', '');
    this.thead = doc.createElement('thead');
    this.tbody = doc.createElement('tbody');
    table.append(this.thead, this.tbody);
    this.root.append(this.title, table);
    host.append(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  update(spec: DataTableSpec): void {
    const doc = this.root.ownerDocument;
    this.title.textContent = spec.baslik;
    const head = doc.createElement('tr');
    for (const s of spec.sutunlar) {
      const th = el(doc, 'th', '', s.ad);
      if (s.anahtar) th.append(' ', el(doc, 'span', 'anahtar-rozeti', s.anahtar));
      head.append(th);
    }
    this.thead.replaceChildren(head);

    const keep = new Set(spec.satirlar.map((r) => r.key));
    for (const [k, tr] of this.rows) {
      if (!keep.has(k)) {
        tr.remove();
        this.rows.delete(k);
      }
    }
    const ordered: HTMLTableRowElement[] = [];
    for (const r of spec.satirlar) {
      let tr = this.rows.get(r.key);
      if (!tr) {
        tr = doc.createElement('tr');
        tr.dataset.key = r.key;
        this.rows.set(r.key, tr);
      }
      tr.className = r.state ? `satir-${r.state}` : '';
      const changed = new Set(r.changed ?? []);
      tr.replaceChildren(
        ...r.cells.map((c, i) => {
          const td = el(doc, 'td', '', c === null ? 'NULL' : String(c));
          if (c === null) td.classList.add('null');
          if (changed.has(i)) td.classList.add('degisti');
          return td;
        }),
      );
      ordered.push(tr);
    }
    this.tbody.replaceChildren(...ordered);

    this.note?.remove();
    this.note = null;
    if (spec.not) {
      this.note = el(doc, 'p', 'data-table-not', spec.not);
      this.root.append(this.note);
    }
  }
}
