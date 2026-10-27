import './check-list.css';

export type DenetimDurumu = 'gecti' | 'kaldi' | 'atlandi' | 'bekliyor';
export interface Denetim {
  ad: string;
  durum: DenetimDurumu;
  ayrinti?: string;
  /** A short result badge, e.g. "200" or "401". */
  sonuc?: string;
}
export interface CheckListSpec {
  baslik: string;
  denetimler: readonly Denetim[];
}

const IKON: Record<DenetimDurumu, string> = { gecti: '✓', kaldi: '✗', atlandi: '–', bekliyor: '…' };

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Everything after the first `kaldi` becomes `atlandi` (a failed check stops the chain). Returns a new array. */
export function zincirle(denetimler: readonly Denetim[]): Denetim[] {
  let dustu = false;
  return denetimler.map((d) => {
    if (dustu) return { ...d, durum: 'atlandi' as const };
    if (d.durum === 'kaldi') dustu = true;
    return { ...d };
  });
}

/** A titled list of checks (`.check-list` > `.check-list-title` + `ol`): icon, name, detail, result badge per row. */
export class CheckList {
  readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly list: HTMLOListElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'check-list');
    this.title = el(doc, 'div', 'check-list-title');
    this.list = el(doc, 'ol', 'check-list-rows');
    this.root.append(this.title, this.list);
    host.append(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  update(spec: CheckListSpec): void {
    const doc = this.root.ownerDocument;
    this.title.textContent = spec.baslik;
    this.list.replaceChildren(
      ...spec.denetimler.map((d) => {
        const li = el(doc, 'li', `denetim denetim-${d.durum}`);
        const orta = el(doc, 'span', 'denetim-orta');
        orta.append(el(doc, 'span', 'denetim-ad', d.ad));
        const ayrinti = d.durum === 'atlandi' ? 'denenmedi' : d.ayrinti;
        if (ayrinti) orta.append(el(doc, 'span', 'denetim-ayrinti', ayrinti));
        li.append(el(doc, 'span', 'denetim-ikon', IKON[d.durum]), orta);
        if (d.sonuc !== undefined && d.durum !== 'atlandi') li.append(el(doc, 'span', 'denetim-sonuc', d.sonuc));
        return li;
      }),
    );
  }
}
