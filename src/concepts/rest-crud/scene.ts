import { select } from 'd3-selection';
import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { CodeTrace } from '../../core/plot/code-trace';
import { breakWord } from '../../core/plot/lane-words';
import { SequenceLayer } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import { sourceBadge } from '../../core/plot/source-badge';
import { TextMeasure } from '../../core/plot/text-measure';
import { RestCards } from './scene-cards';
import { REST_ROZET, type RestParams } from './scenario';
import { deriveRestView, restLabRozet } from './view';
import './rest-crud.css';

const NS = 'http://www.w3.org/2000/svg';
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;
/** Below this stage width (px) the cards sit under the diagram. */
const NARROW = 700;
const GAP = 12;
/** Horizontal room (px) a lane title keeps clear of its neighbours. */
const LANE_PAD = 12;
const CARDS_W = 600;
/** Stage width (px) from which the cards take two columns beside the diagram; narrower stages use the medium layout. */
const WIDE = 1000;
const MEDIUM_CARDS_W = 340;
const CARDS_WIDE = 800;
/** A narrow diagram is at least this tall and at most this tall (px). */
const NARROW_MIN = 300;
const NARROW_MAX = 900;
/** Text lines a narrow diagram needs for its lane titles and, per trace event, for its arrow and wrapped label. */
const NARROW_HEADER = 7;
const NARROW_ROW = 3.2;
/** Height (px) reserved for the Ders code strip and the badge row when layout is unavailable. */
const STRIP_FALLBACK_H = 150;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 2;

/**
 * Scene of the rest-crud page: the source badge top right, the sequence diagram (SVG) with the
 * request / response / terminal cards beside it (narrow: below it), and in Ders the code strip under the stage.
 * Updates coalesce into one frame; Lab control changes render without interpolation.
 */
export function mountRestScene(
  host: HTMLElement,
  player: StepPlayer<RestParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = host.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'rest-scene';
  const rozetYeri = doc.createElement('div');
  rozetYeri.className = 'rozet-yeri';
  const stage = doc.createElement('div');
  stage.className = 'rest-stage';
  const diagram = doc.createElement('div');
  diagram.className = 'rest-diagram';
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  diagram.append(svg);
  const left = doc.createElement('div');
  left.className = 'rest-left';
  const stripHost = doc.createElement('div');
  stripHost.className = 'code-strip';
  const strip = new CodeTrace(stripHost);
  left.append(diagram, stripHost);
  stage.append(left);
  // the cards column spans the stage and the code strip's height: the cards need all of it
  const cards = new RestCards(stage);
  scene.append(rozetYeri, stage);
  host.append(scene);

  const measure = new TextMeasure(probe);
  const layer = new SequenceLayer(select(g) as never, measure);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;
  let pending: { s: PlayerState<RestParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;

  /** Area of the stage (estimated where layout is unavailable). */
  function area(): { w: number; h: number } {
    const r = stage.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { w: Math.floor(r.width), h: Math.floor(r.height) };
    return { w: size!.w, h: Math.max(160, size!.h - 60) };
  }

  function rozet(state: PlayerState<RestParams>): void {
    const r: Rozet = labRozeti ? restLabRozet(state.params) : (REST_ROZET[state.step.id] ?? { tur: 'kitap' });
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  function draw(state: PlayerState<RestParams>, cause: ChangeCause, instant: boolean): void {
    layer.interrupt();
    const v = deriveRestView(state.params);
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    const a = area();
    const tick = measure.fonts(mode).tick;
    const narrow = a.w < NARROW;
    // medium (the Lab stage next to the explanation): request and response beside the diagram, terminal and table below both
    const medium = !narrow && a.w < WIDE;
    stage.toggleAttribute('data-narrow', narrow);
    stage.toggleAttribute('data-medium', medium);
    // a phone has no room for the strip next to the diagram and the cards
    stripHost.hidden = mode !== 'ders' || narrow;
    const sr = stripHost.getBoundingClientRect();
    const stripH = stripHost.hidden ? 0 : (sr.height > 0 ? sr.height : STRIP_FALLBACK_H) + GAP / 2;
    // the summary table needs room: on that step the cards take most of the width
    const cardsW = medium ? MEDIUM_CARDS_W : v.ozet !== null ? Math.min(CARDS_WIDE, Math.floor(a.w * 0.6)) : Math.min(CARDS_W, Math.floor(a.w * 0.47));
    cards.update(v, state.params.program, medium);
    const bottom = medium ? cards.bottomHeight() + GAP : 0;
    const dw = narrow ? a.w : a.w - cardsW - GAP;
    // narrow: the diagram is as tall as the whole trace needs (wrapped labels take a few lines per event); the cards
    // sit under it and the stage scrolls
    const dh = narrow ? Math.min(NARROW_MAX, Math.max(NARROW_MIN, Math.ceil(tick * (NARROW_HEADER + NARROW_ROW * v.sequence.messages.length)))) : Math.max(120, a.h - stripH - bottom);
    stage.style.setProperty('--cards-w', `${cardsW}px`);
    stage.style.setProperty('--diagram-h', `${dh}px`);
    svg.setAttribute('width', String(dw));
    svg.setAttribute('height', String(dh));
    svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
    // sub-titles under the lane titles go when one of them is wider than its lane (phone width)
    const lane = dw / v.sequence.lanes.length - LANE_PAD;
    const subFits = v.sequence.lanes.every((l) => measure.width(l.sub ?? '', 'seq-lane-sub', tick) <= lane);
    const lanes = v.sequence.lanes.map((l) => ({
      id: l.id,
      label: l.label.flatMap((t) => breakWord(t, lane, (x) => measure.width(x, 'seq-lane-label', tick))),
      ...(subFits && l.sub ? { sub: l.sub } : {}),
    }));
    // an arrow label whose longest word cannot be centred on its arrow (it would leave the diagram) breaks after its first "?" or "."
    const kirilir = (t: string): boolean => t.split(' ').some((w) => measure.width(w, 'seq-msg-label', tick) > dw / 2 - LANE_PAD);
    const messages = v.sequence.messages.map((m) => (m.kind !== 'note' && kirilir(m.label) ? { ...m, label: m.label.replace(/[?.]/, (c) => `${c} `) } : m));
    const sequence = { ...v.sequence, lanes, messages };
    layer.draw(sequence, { left: 0, top: 0, width: dw, height: dh }, ms, tick);
    rozet(state);
    stripHost.toggleAttribute('data-empty', v.code.active.length === 0);
    // before the first event no line runs: the strip keeps its height but lists nothing
    // the strip windows around the line that decides the send, not around the first line the trace touches (the definition)
    strip.update({ ...v.code, active: v.karar !== null ? [v.karar] : v.code.active, lines: v.code.active.length === 0 ? [] : v.code.lines, window: STRIP_WINDOW });
    rendered = true;
  }

  function render(state: PlayerState<RestParams>, cause: ChangeCause, instant: boolean): void {
    if (size) draw(state, cause, instant);
  }

  function flush(): void {
    rafId = null;
    const p = pending;
    pending = null;
    if (p) render(p.s, p.cause, false);
  }
  const raf = (cb: () => void): number =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
  const cancelRaf = (id: number): void => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
  };

  const unsubscribe = player.subscribe((s, cause) => {
    if (cause === 'param') labRozeti = true;
    else if (cause === 'step') labRozeti = false;
    const merged = pending && causeRank[pending.cause] > causeRank[cause] ? pending.cause : cause;
    pending = { s, cause: merged };
    if (ds === 0) flush();
    else if (rafId === null) rafId = raf(flush);
  });

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      // the first draw animates in; later resizes are instant
      render(player.state, 'step', rendered);
    },
    setMode(m: Mode): void {
      if (m === mode) return;
      mode = m;
      if (size) render(player.state, 'step', true);
    },
    destroy(): void {
      unsubscribe();
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      layer.clear();
      strip.destroy();
      cards.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountRestExtra(el: HTMLElement, player: StepPlayer<RestParams>): void {
  const trace = new CodeTrace(el);
  const sync = (): void => trace.update(deriveRestView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
