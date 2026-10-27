import './segment-strip.css';

export interface Parca {
  metin: string;
  etiket?: string;
  /** Colour tone of the segment, 0 (neutral) to 3. */
  ton?: 0 | 1 | 2 | 3;
  /** Character indices to highlight as `.fark`. */
  fark?: readonly number[];
  /** Show only this many leading characters plus "…"; the full text goes to `title`. */
  kisalt?: number;
}
export interface SegmentStripSpec {
  baslik?: string;
  parcalar: readonly Parca[];
  /** Drawn between segments, e.g. ".". */
  ayirici?: string;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Indices where `a` differs from `b`, or where `b` has no character. */
export function farkIndeksleri(a: string, b: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

/** A strip of monospaced segments (a token, a hash, a header value) with optional labels, shortening and diff marks. */
export class SegmentStrip {
  readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly row: HTMLDivElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'segment-strip');
    this.title = el(doc, 'div', 'segment-strip-title');
    this.row = el(doc, 'div', 'segment-strip-row');
    this.root.append(this.title, this.row);
    host.append(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  update(spec: SegmentStripSpec): void {
    const doc = this.root.ownerDocument;
    this.title.hidden = !spec.baslik;
    this.title.textContent = spec.baslik ?? '';
    const nodes: HTMLElement[] = [];
    spec.parcalar.forEach((p, i) => {
      if (i > 0 && spec.ayirici) nodes.push(el(doc, 'span', 'ayirici', spec.ayirici));
      const b = el(doc, 'span', `parca ton-${p.ton ?? 0}`);
      if (p.etiket) b.append(el(doc, 'span', 'parca-etiket', p.etiket));
      const m = el(doc, 'span', 'parca-metin');
      const kisa = p.kisalt !== undefined && p.metin.length > p.kisalt;
      const gorunen = kisa ? p.metin.slice(0, p.kisalt) : p.metin;
      if (kisa) m.title = p.metin;
      const fark = new Set(p.fark ?? []);
      if (fark.size === 0) m.append(gorunen);
      else
        [...gorunen].forEach((ch, k) => {
          m.append(fark.has(k) ? el(doc, 'span', 'fark', ch) : ch);
        });
      if (kisa) m.append('…');
      b.append(m);
      nodes.push(b);
    });
    this.row.replaceChildren(...nodes);
  }
}
