import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import type { PlayerState, StepPlayer } from '../../core/player';
import { CheckList } from '../../core/plot/check-list';
import { CodeTrace } from '../../core/plot/code-trace';
import { HttpCards } from '../../core/plot/http-cards';
import { breakWord } from '../../core/plot/lane-words';
import { SequenceLayer } from '../../core/plot/sequence';
import { sourceBadge, type Rozet } from '../../core/plot/source-badge';
import { TextMeasure } from '../../core/plot/text-measure';
import type { SceneHandle } from '../../core/shell';
import { CORS_ROZET, type CorsParams } from './scenario';
import { corsLabRozet, deriveCorsView } from './view';
import './cors-preflight.css';

const NS = 'http://www.w3.org/2000/svg';
/** Below this stage width (px) the cards sit under the diagram and the code strip is left out. */
const NARROW = 700;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 1;
/** Narrow sequence diagram: at least / at most this tall (px); text lines for its lane titles and per message. */
const NARROW_MIN = 300;
const NARROW_MAX = 760;
const NARROW_HEADER = 8;
const NARROW_ROW = 3.2;
/** Horizontal room (px) a lane title keeps clear of its neighbours. */
const LANE_PAD = 12;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** An origin tag: a small caption and the origin text. */
function kokenEtiketi(doc: Document, cls: string, baslik: string): { root: HTMLElement; deger: HTMLElement } {
  const root = el(doc, 'div', `koken-etiketi ${cls}`);
  const deger = el(doc, 'span', 'koken-deger');
  root.append(el(doc, 'span', 'koken-baslik', baslik), deger);
  return { root, deger };
}

/** Writes an origin so that a narrow screen may break it only after a dot or a slash. */
function kokenYaz(e: HTMLElement, metin: string): void {
  const doc = e.ownerDocument;
  const parcalar = metin.split(/(?<=[./])/);
  e.replaceChildren(...parcalar.flatMap((t, i) => (i === 0 ? [t] : [doc.createElement('wbr'), t])));
}

/**
 * Scene of the cors-preflight page: the two origin tags (page / API) and the badge on top, the sequence diagram with
 * beside it the check list and the request, response and terminal cards, the explanation line, and in Ders the code strip.
 */
export function mountCorsScene(
  host: HTMLElement,
  player: StepPlayer<CorsParams>,
  initialMode: Mode,
  _opts: { durationScale?: number } = {},
): SceneHandle {
  const doc = host.ownerDocument;
  const scene = el(doc, 'div', 'cors-scene');
  const ust = el(doc, 'div', 'cors-ust');
  const kokenSerit = el(doc, 'div', 'koken-serit');
  const sayfaK = kokenEtiketi(doc, 'koken-sayfa', 'Sayfa');
  const apiK = kokenEtiketi(doc, 'koken-api', 'API');
  kokenSerit.append(sayfaK.root, apiK.root);
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  ust.append(kokenSerit, rozetYeri);
  const stage = el(doc, 'div', 'cors-stage');
  const main = el(doc, 'div', 'cors-main');
  const yan = el(doc, 'div', 'cors-yan');

  const diyagram = el(doc, 'div', 'cors-diyagram');
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  diyagram.append(svg);

  const aciklama = el(doc, 'p', 'cors-aciklama');
  main.append(diyagram, aciklama);

  const denetimYeri = el(doc, 'div', 'denetim-yeri');
  const denetim = new CheckList(denetimYeri);
  const kartlar = new HttpCards(yan);
  yan.prepend(denetimYeri);
  stage.append(main, yan);
  const stripHost = el(doc, 'div', 'code-strip');
  const strip = new CodeTrace(stripHost);
  scene.append(ust, stage, stripHost);
  host.append(scene);

  const measure = new TextMeasure(probe);
  const layer = new SequenceLayer(select(g) as never, measure);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;
  /** Height (px) the diagram was last drawn at; a later change of its box (a web font arriving wraps the explanation) redraws it. */
  let drawnH = 0;

  function rozet(state: PlayerState<CorsParams>): void {
    const r: Rozet = labRozeti ? corsLabRozet(state.params) : (CORS_ROZET[state.step.id] ?? { tur: 'kitap' });
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  function draw(state: PlayerState<CorsParams>): void {
    const p = state.params;
    // the book's printed output belongs to the step's own badge; a Lab change drops it
    const v = deriveCorsView(p, !labRozeti);

    const sr = stage.getBoundingClientRect();
    const w = sr.width || size!.w;
    const narrow = w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    stripHost.hidden = mode !== 'ders' || narrow || v.code.active.length === 0;
    strip.update({ ...v.code, window: STRIP_WINDOW });

    kokenSerit.hidden = v.ozet;
    kokenYaz(sayfaK.deger, v.kokenler.sayfa);
    kokenYaz(apiK.deger, v.kokenler.api);
    kokenSerit.toggleAttribute('data-ayni', !v.ozet && v.kokenler.sayfa === v.kokenler.api);

    const yanVar = v.denetim !== null || v.http.istek !== undefined || v.http.yanitlar.length > 0 || v.http.terminal.length > 0;
    stage.toggleAttribute('data-yan', yanVar);
    yan.hidden = !yanVar;
    denetimYeri.hidden = v.denetim === null;
    if (v.denetim) denetim.update(v.denetim);
    kartlar.update(v.http);
    // desktop: the cards column cannot grow, so it gives up the terminal (title first, then the whole box) until it fits the stage; request, responses and checks always stay
    for (const sik of narrow ? [0] : [0, 1, 2]) {
      stage.dataset.sik = String(sik);
      if (narrow || yan.hidden || yan.getBoundingClientRect().height <= stage.clientHeight + 1) break;
    }

    aciklama.hidden = v.aciklama === null;
    aciklama.textContent = v.aciklama ?? '';

    // measure the diagram box without the previous drawing inside it
    svg.setAttribute('height', '0');
    const tick = measure.fonts(mode).tick;
    const dw = Math.floor(diyagram.getBoundingClientRect().width) || size!.w;
    const dh = narrow
      ? Math.min(NARROW_MAX, Math.max(NARROW_MIN, Math.ceil(tick * (NARROW_HEADER + NARROW_ROW * v.sequence.messages.length))))
      : Math.max(160, Math.floor(diyagram.getBoundingClientRect().height) || Math.max(160, size!.h - 60));
    svg.setAttribute('width', String(dw));
    drawnH = dh;
    svg.setAttribute('height', String(dh));
    svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
    diyagram.style.setProperty('--diyagram-h', `${dh}px`);
    const lane = dw / v.sequence.lanes.length - LANE_PAD;
    const lanes = v.sequence.lanes.map((l) => ({ ...l, label: l.label.flatMap((t) => breakWord(t, lane, (x) => measure.width(x, 'seq-lane-label', tick))) }));
    layer.draw({ ...v.sequence, lanes }, { left: 0, top: 0, width: dw, height: dh }, 0, tick);

    rozet(state);
  }

  function render(state: PlayerState<CorsParams>): void {
    if (size) draw(state);
  }

  const boxWatch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    if (size && !stage.hasAttribute('data-narrow') && Math.abs(diyagram.clientHeight - drawnH) > 1) render(player.state);
  });
  boxWatch?.observe(diyagram);

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
      layer.clear();
      denetim.destroy();
      kartlar.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountCorsExtra(host: HTMLElement, player: StepPlayer<CorsParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveCorsView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
