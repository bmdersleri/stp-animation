import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import type { PlayerState, StepPlayer } from '../../core/player';
import { CheckList } from '../../core/plot/check-list';
import { CodeTrace } from '../../core/plot/code-trace';
import { DataTable } from '../../core/plot/data-table';
import { HttpCards } from '../../core/plot/http-cards';
import { KitapBlokView } from '../../core/plot/kitap-blok';
import { breakWord } from '../../core/plot/lane-words';
import { SequenceLayer } from '../../core/plot/sequence';
import { sourceBadge, type Rozet } from '../../core/plot/source-badge';
import { TextMeasure } from '../../core/plot/text-measure';
import type { SceneHandle } from '../../core/shell';
import { COMPOSE_ROZET, type ComposeParams } from './scenario';
import { composeLabRozet, deriveComposeView } from './view';
import './docker-compose.css';

const NS = 'http://www.w3.org/2000/svg';
/** Below this stage width (px) the boxes stack and the code strip is left out. */
const NARROW = 700;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 1;
/** Narrow sequence diagram: at least / at most this tall (px); text lines for its lane titles and per message. */
const NARROW_MIN = 300;
const NARROW_MAX = 900;
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

/**
 * Scene of the docker-compose page: the badge on top, the start sequence diagram (Compose, database, API) with beside it
 * the services table, the probe list and the terminal, the notes under them, and in Ders the code strip. The intro and
 * summary steps replace all of it with the book's definition, table and notes; steps 2-7 have no diagram.
 */
export function mountComposeScene(
  host: HTMLElement,
  player: StepPlayer<ComposeParams>,
  initialMode: Mode,
  _opts: { durationScale?: number } = {},
): SceneHandle {
  const doc = host.ownerDocument;
  const scene = el(doc, 'div', 'compose-scene');
  const ust = el(doc, 'div', 'compose-ust');
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  ust.append(rozetYeri);

  const stage = el(doc, 'div', 'compose-stage');
  const kitap = new KitapBlokView(stage);
  const govde = el(doc, 'div', 'compose-govde');
  const diyagram = el(doc, 'div', 'compose-diyagram');
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  diyagram.append(svg);

  const sag = el(doc, 'div', 'compose-sag');
  const tabloYeri = el(doc, 'div', 'tablo-yeri');
  const denetimYeri = el(doc, 'div', 'denetim-yeri');
  const kartYeri = el(doc, 'div', 'compose-kartlar');
  sag.append(tabloYeri, denetimYeri, kartYeri);
  govde.append(diyagram, sag);
  const notlarYeri = el(doc, 'div', 'compose-notlar');
  stage.append(kitap.root, govde, notlarYeri);
  const tablo = new DataTable(tabloYeri);
  const denetim = new CheckList(denetimYeri);
  const kartlar = new HttpCards(kartYeri);

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
  /** Height (px) the diagram was last drawn at; a later change of its box redraws it. */
  let drawnH = 0;

  function rozet(state: PlayerState<ComposeParams>): void {
    const r: Rozet = labRozeti ? composeLabRozet(state.params) : (COMPOSE_ROZET[state.step.id] ?? { tur: 'kitap' });
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  function draw(state: PlayerState<ComposeParams>): void {
    // the book's printed output belongs to the step's own badge; a Lab change drops it
    const v = deriveComposeView(state.params, !labRozeti);

    const w = stage.getBoundingClientRect().width || size!.w;
    const narrow = w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    stripHost.hidden = mode !== 'ders' || narrow || v.code.active.length === 0;
    strip.update({ ...v.code, window: STRIP_WINDOW });

    // intro and summary: the book's text takes the place of everything else
    kitap.root.hidden = v.kitap === null;
    govde.hidden = v.kitap !== null;
    notlarYeri.hidden = v.kitap !== null;
    if (v.kitap) {
      kitap.update(v.kitap);
      layer.clear();
      drawnH = 0;
      rozet(state);
      return;
    }
    kitap.update(null);

    tabloYeri.hidden = v.tablo === null;
    if (v.tablo) tablo.update(v.tablo);
    denetimYeri.hidden = v.problar === null;
    if (v.problar) denetim.update(v.problar);
    kartYeri.hidden = v.terminal.length === 0;
    kartlar.update({ yanitlar: [], terminal: v.terminal });
    notlarYeri.replaceChildren(...v.notlar.map((n) => el(doc, 'p', 'compose-not', n)));
    notlarYeri.hidden = v.notlar.length === 0;

    // steps 2-7 have no diagram: the table and the terminal take its place
    const cizgi = v.sequence !== null;
    diyagram.hidden = !cizgi;
    govde.toggleAttribute('data-cizgi', cizgi);
    if (!v.sequence) {
      layer.clear();
      drawnH = 0;
      rozet(state);
      return;
    }

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
    // only a phone breaks inside a lane title; at desktop widths a title wraps at spaces
    const lanes = narrow ? v.sequence.lanes.map((l) => ({ ...l, label: l.label.flatMap((t) => breakWord(t, lane, (x) => measure.width(x, 'seq-lane-label', tick))) })) : v.sequence.lanes;
    layer.draw({ ...v.sequence, lanes }, { left: 0, top: 0, width: dw, height: dh }, 0, tick);

    rozet(state);
  }

  function render(state: PlayerState<ComposeParams>): void {
    if (size) draw(state);
  }

  const boxWatch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    if (size && !stage.hasAttribute('data-narrow') && !diyagram.hidden && Math.abs(diyagram.clientHeight - drawnH) > 1) render(player.state);
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
      tablo.destroy();
      kitap.destroy();
      denetim.destroy();
      kartlar.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountComposeExtra(host: HTMLElement, player: StepPlayer<ComposeParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveComposeView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
