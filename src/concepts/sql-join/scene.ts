import type { PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { CodeTrace } from '../../core/plot/code-trace';
import { DataTable, type DataTableSpec } from '../../core/plot/data-table';
import { sourceBadge } from '../../core/plot/source-badge';
import { SQL_ROZET, type SqlParams } from './scenario';
import { deriveSqlView, sqlLabRozet, type SqlView } from './view';
import './sql-join.css';


/** Below this stage width (px) everything stacks in one column. */
const NARROW = 700;
/** From this stage width (px) the source tables sit left and the result right. */
const WIDE = 1000;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 3;
/** The strip holds this many lines; a shorter listing is shown whole. */
const STRIP_LINES = 7;
const ILISKI = 'yazarlar ||--o{ kitaplar';
const OZET_BASLIK = ['JOIN türü', 'Dönen kayıtlar', 'Kullanım örneği', 'Risk'] as const;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A table that exists only while its spec does. */
class Slot {
  private table: DataTable | null = null;
  constructor(readonly host: HTMLElement) {}
  set(spec: DataTableSpec | null): void {
    this.host.hidden = spec === null;
    if (spec === null) {
      this.table?.destroy();
      this.table = null;
      return;
    }
    (this.table ??= new DataTable(this.host)).update(spec);
  }
  destroy(): void {
    this.table?.destroy();
    this.table = null;
  }
}

/**
 * Scene of the sql-join page: the source badge top right, the two source tables with the relationship line and the
 * condition badge, the result table(s) with the notes and the parameter card, and in Ders the code strip.
 * There is no diagram: rows light up through CSS transitions, so every update is a plain re-render.
 */
export function mountSqlScene(
  host: HTMLElement,
  player: StepPlayer<SqlParams>,
  initialMode: Mode,
  _opts: { durationScale?: number } = {},
): SceneHandle {
  const doc = host.ownerDocument;
  const scene = el(doc, 'div', 'sql-scene');
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  const stage = el(doc, 'div', 'sql-stage');
  const sol = el(doc, 'div', 'sql-sol');
  const sag = el(doc, 'div', 'sql-sag');

  const kaynaklar = el(doc, 'div', 'sql-kaynaklar');
  const yazarSlot = new Slot(el(doc, 'div', 'tablo-yeri tablo-yazarlar'));
  const kitapSlot = new Slot(el(doc, 'div', 'tablo-yeri tablo-kitaplar'));
  kaynaklar.append(yazarSlot.host, kitapSlot.host);
  const orta = el(doc, 'div', 'sql-orta');
  const iliski = el(doc, 'div', 'iliski', ILISKI);
  const kosul = el(doc, 'div', 'kosul-rozeti');
  orta.append(iliski, kosul);
  const stripHost = el(doc, 'div', 'code-strip');
  const strip = new CodeTrace(stripHost);
  sol.append(kaynaklar, orta, stripHost);

  const sonucSlot = new Slot(el(doc, 'div', 'tablo-yeri tablo-sonuc'));
  const ikinciSlot = new Slot(el(doc, 'div', 'tablo-yeri tablo-ikinci'));
  const siraNotu = el(doc, 'p', 'sira-notu');
  const parametre = el(doc, 'div', 'parametre-karti');
  const ozetHost = el(doc, 'div', 'ozet-host');
  sag.append(sonucSlot.host, ikinciSlot.host, siraNotu, parametre, ozetHost);
  stage.append(sol, sag);
  scene.append(rozetYeri, stage);
  host.append(scene);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;

  function width(): number {
    const r = stage.getBoundingClientRect();
    return r.width > 0 ? Math.floor(r.width) : size!.w;
  }

  function ozetOlustur(v: SqlView): void {
    ozetHost.hidden = v.ozet === null;
    if (!v.ozet) {
      ozetHost.replaceChildren();
      return;
    }
    const t = el(doc, 'table', 'ozet-tablosu');
    const head = el(doc, 'tr', '');
    for (const h of OZET_BASLIK) head.append(el(doc, 'th', '', h));
    const thead = el(doc, 'thead', '');
    thead.append(head);
    t.append(thead);
    const body = el(doc, 'tbody', '');
    for (const r of v.ozet.satirlar) {
      const tr = el(doc, 'tr', '');
      r.forEach((c, i) => tr.append(el(doc, 'td', i === 0 ? 'tur' : '', c)));
      body.append(tr);
    }
    t.append(body);
    const sayilar = el(doc, 'ul', 'ozet-sayilar');
    for (const [ad, n] of v.ozet.sayilar) sayilar.append(el(doc, 'li', '', `${ad}: ${n} satır`));
    ozetHost.replaceChildren(t, sayilar);
  }

  function draw(state: PlayerState<SqlParams>): void {
    const v = deriveSqlView(state.params);
    const w = width();
    const narrow = w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    stage.toggleAttribute('data-wide', !narrow && w >= WIDE);
    stage.toggleAttribute('data-ozet', v.ozet !== null);
    stripHost.hidden = mode !== 'ders';

    yazarSlot.set(v.yazarlar);
    kitapSlot.set(v.kitaplar);
    sonucSlot.set(v.sonuc);
    ikinciSlot.set(v.ikinci);
    ozetOlustur(v);

    const bos = v.sonuc === null && v.ozet === null;
    orta.hidden = false;
    iliski.hidden = false;
    kosul.hidden = v.kosul === null;
    kosul.className = `kosul-rozeti ${v.kosul === null ? '' : v.kosul.deger === null ? 'null' : v.kosul.deger ? 'dogru' : 'yanlis'}`.trim();
    kosul.textContent = v.kosul?.metin ?? '';

    siraNotu.hidden = v.siraNotu === null;
    siraNotu.textContent = v.siraNotu ?? '';
    parametre.hidden = v.parametreler === null;
    parametre.textContent = v.parametreler ? `$1 → [${v.parametreler.join(', ')}]` : '';
    sag.hidden = bos && v.parametreler === null;

    const r = state.params;
    const rozet = labRozeti ? sqlLabRozet(r) : (SQL_ROZET[state.step.id] ?? { tur: 'kitap' as const });
    rozetYeri.replaceChildren(sourceBadge(doc, rozet.tur, rozet.ref));
    // a query fits the strip whole; only the long book listing (veri step) is windowed around its active line
    strip.update(v.code.lines.length > STRIP_LINES ? { ...v.code, window: STRIP_WINDOW } : v.code);
  }

  function render(state: PlayerState<SqlParams>): void {
    if (size) draw(state);
  }

  // rows change through CSS transitions, so every update is a plain, synchronous re-render
  const unsubscribe = player.subscribe((s, cause) => {
    if (cause === 'param') labRozeti = true;
    else if (cause === 'step') labRozeti = false;
    render(s);
  });

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      render(player.state);
    },
    setMode(m: Mode): void {
      if (m === mode) return;
      mode = m;
      if (size) render(player.state);
    },
    destroy(): void {
      unsubscribe();
      for (const s of [yazarSlot, kitapSlot, sonucSlot, ikinciSlot]) s.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole SQL on screen under the step text. */
export function mountSqlExtra(host: HTMLElement, player: StepPlayer<SqlParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveSqlView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
