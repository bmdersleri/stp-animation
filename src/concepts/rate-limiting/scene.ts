import type { Mode } from '../../core/mode';
import type { PlayerState, StepPlayer } from '../../core/player';
import { CheckList } from '../../core/plot/check-list';
import { CodeTrace } from '../../core/plot/code-trace';
import { DataTable } from '../../core/plot/data-table';
import { HttpCards } from '../../core/plot/http-cards';
import { sourceBadge, type Rozet } from '../../core/plot/source-badge';
import { TextMeasure } from '../../core/plot/text-measure';
import type { SceneHandle } from '../../core/shell';
import { RATE_ROZET, type RateParams } from './scenario';
import { TimelineLayer } from './scene-timeline';
import { deriveRateView, rateLabRozet, type RateKitapBlok } from './view';
import './rate-limiting.css';

const NS = 'http://www.w3.org/2000/svg';
/** Below this stage width (px) the lower boxes stack and the code strip is left out. */
const NARROW = 700;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 1;
/** Phone width: the timeline keeps this height (px) and the stage scrolls. */
const NARROW_H = 260;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Puts a line-break opportunity after every `.`, `/`, `,` and `:` so a long value breaks at such a boundary, not inside a word. */
function kirilmaYumusat(root: Element): void {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  for (const t of nodes) {
    const parts = t.data.split(/(?<=[./,:])(?=[^\s])/);
    if (parts.length < 2) continue;
    t.replaceWith(...parts.flatMap((x, i) => (i === 0 ? [x] : [doc.createElement('wbr'), x])));
  }
}

/**
 * Scene of the rate-limiting page: the badge and legend on top, the timeline (one row per ip), under it the limiter
 * table, the terminal and (login) the check list, and in Ders the code strip. The intro and summary steps replace the
 * legend, timeline and lower row with the book's definition, table and notes.
 */
export function mountRateScene(
  host: HTMLElement,
  player: StepPlayer<RateParams>,
  initialMode: Mode,
  _opts: { durationScale?: number } = {},
): SceneHandle {
  const doc = host.ownerDocument;
  const scene = el(doc, 'div', 'rate-scene');
  const ust = el(doc, 'div', 'rate-ust');
  const lejant = el(doc, 'div', 'rate-lejant');
  const cors = el(doc, 'span', 'lejant-cors');
  cors.append(el(doc, 'span', 'lejant-nokta cors'), '403 (CORS, sınırlayıcıya ulaşmadı)');
  lejant.append(el(doc, 'span', 'lejant-nokta izin'), 'kabul', el(doc, 'span', 'lejant-nokta red'), '429', cors);
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  ust.append(lejant, rozetYeri);

  const stage = el(doc, 'div', 'rate-stage');
  const kitapBlok = el(doc, 'div', 'kitap-blok');
  const kitapTablolari: DataTable[] = [];
  const cizelge = el(doc, 'div', 'rate-cizelge');
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  svg.append(probe);
  cizelge.append(svg);

  const alt = el(doc, 'div', 'rate-alt');
  const tabloYeri = el(doc, 'div', 'tablo-yeri');
  const sagYer = el(doc, 'div', 'rate-sag');
  const denetimYeri = el(doc, 'div', 'denetim-yeri');
  alt.append(tabloYeri, sagYer, denetimYeri);
  const tablo = new DataTable(tabloYeri);
  const kartlar = new HttpCards(sagYer);
  const denetim = new CheckList(denetimYeri);
  stage.append(kitapBlok, cizelge, alt);
  const stripHost = el(doc, 'div', 'code-strip');
  const strip = new CodeTrace(stripHost);
  scene.append(ust, stage, stripHost);
  host.append(scene);

  const measure = new TextMeasure(probe);
  const layer = new TimelineLayer(svg, measure);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;
  /** Height (px) the timeline was last drawn at; a later change of its box (a web font arriving) redraws it. */
  let drawnH = 0;

  function rozet(state: PlayerState<RateParams>): void {
    const r: Rozet = labRozeti ? rateLabRozet(state.params) : (RATE_ROZET[state.step.id] ?? { tur: 'kitap' });
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  /** Empties the book block (a flow step keeps no hidden book table). */
  function kitapTemizle(): void {
    kitapTablolari.splice(0).forEach((t) => t.destroy());
    kitapBlok.replaceChildren();
  }

  /** The book's own text: the bold "Tanım." paragraph, the tables, then the muted sentences. */
  function kitapYaz(b: RateKitapBlok): void {
    kitapTemizle();
    if (b.tanim) {
      const para = el(doc, 'p', 'tanim-metin');
      para.append(el(doc, 'strong', '', 'Tanım. '), b.tanim);
      kitapBlok.append(para);
    }
    for (const spec of b.tablolar) {
      const t = new DataTable(kitapBlok);
      t.update(spec);
      kitapTablolari.push(t);
    }
    for (const n of b.notlar) kitapBlok.append(el(doc, 'p', 'kitap-not', n));
  }

  function draw(state: PlayerState<RateParams>): void {
    // the book's printed output belongs to the step's own badge; a Lab change drops it
    const v = deriveRateView(state.params, !labRozeti);

    const w = stage.getBoundingClientRect().width || size!.w;
    const narrow = w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    stripHost.hidden = mode !== 'ders' || narrow || v.code.active.length === 0;
    strip.update({ ...v.code, window: STRIP_WINDOW });

    // intro and summary: the book's text takes the place of the legend, the timeline and the lower row
    kitapBlok.hidden = v.kitap === null;
    lejant.hidden = v.kitap !== null;
    cizelge.hidden = v.kitap !== null;
    alt.hidden = v.kitap !== null;
    if (v.kitap) {
      kitapYaz(v.kitap);
      drawnH = 0;
      rozet(state);
      return;
    }
    kitapTemizle();

    cors.hidden = !v.timeline.noktalar.some((n) => n.durum === '403');
    tablo.update(v.tablo);
    denetimYeri.hidden = v.denetim === null;
    if (v.denetim) denetim.update(v.denetim);
    alt.toggleAttribute('data-login', v.denetim !== null);
    const hamTerminal = v.terminal;
    kartlar.update({ yanitlar: [], terminal: hamTerminal });
    for (const t of sagYer.querySelectorAll('.terminal-satir')) kirilmaYumusat(t);
    // desktop: the lower row is capped; the terminal gives up its oldest lines until the row fits
    if (!narrow && hamTerminal.length > 0) {
      // the book's own printed lines stay verbatim and complete; only later lines (never the newest) are dropped
      const satirlar = [...sagYer.querySelectorAll('.terminal-satir')];
      let gizli = 0;
      for (let i = v.kitapSatir; i < satirlar.length - 1 && alt.scrollHeight > alt.clientHeight + 1; i++, gizli++) satirlar[i].remove();
      const baslik = sagYer.querySelector('.kart-baslik');
      if (baslik && gizli > 0) baslik.textContent = `Terminal · ${satirlar.length - gizli} / ${satirlar.length} satır`;
    }

    // measure the timeline box without the previous drawing inside it
    svg.setAttribute('height', '0');
    const dw = Math.floor(cizelge.getBoundingClientRect().width) || size!.w;
    const dh = narrow ? NARROW_H : Math.max(96, Math.floor(cizelge.getBoundingClientRect().height) || Math.max(96, size!.h - 60));
    svg.setAttribute('width', String(dw));
    svg.setAttribute('height', String(dh));
    svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
    drawnH = dh;
    layer.update(v.timeline, { left: 0, top: 0, width: dw, height: dh }, 0);

    rozet(state);
  }

  function render(state: PlayerState<RateParams>): void {
    if (size) draw(state);
  }

  const boxWatch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    if (size && !stage.hasAttribute('data-narrow') && Math.abs(cizelge.clientHeight - drawnH) > 1) render(player.state);
  });
  boxWatch?.observe(cizelge);

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
      render(player.state);
    },
    destroy(): void {
      unsubscribe();
      boxWatch?.disconnect();
      layer.destroy();
      tablo.destroy();
      kitapTemizle();
      denetim.destroy();
      kartlar.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountRateExtra(host: HTMLElement, player: StepPlayer<RateParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveRateView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
