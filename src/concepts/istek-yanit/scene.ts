import { select } from 'd3-selection';
import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { CodeTrace } from '../../core/plot/code-trace';
import { SequenceLayer } from '../../core/plot/sequence';
import { TextMeasure } from '../../core/plot/text-measure';
import { IstekCards } from './scene-cards';
import type { IstekParams } from './scenario';
import { deriveIstekView } from './view';
import './istek-yanit.css';

const NS = 'http://www.w3.org/2000/svg';
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates. */
const MS_STEP = 600;
/** Below this stage width (px) the cards sit under the diagram. */
const NARROW = 700;
const GAP = 12;
const CARDS_W = 340;
/** A narrow diagram is this share of the stage height, within these bounds (px). */
const NARROW_SHARE = 0.55;
const NARROW_MIN = 300;
const NARROW_MAX = 460;
/** Height (px) reserved for the Ders code strip when layout is unavailable (title + five lines). */
const STRIP_FALLBACK_H = 150;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 2;

/**
 * Scene of the istek-yanit page: the sequence diagram (SVG) with the request / response / terminal cards beside
 * it (narrow: below it), and in Ders the code strip under the stage. Updates coalesce into one frame; Lab
 * control changes render without interpolation.
 */
export function mountIstekScene(
  host: HTMLElement,
  player: StepPlayer<IstekParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = host.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'istek-scene';
  const stage = doc.createElement('div');
  stage.className = 'istek-stage';
  const diagram = doc.createElement('div');
  diagram.className = 'istek-diagram';
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  diagram.append(svg);
  const cards = new IstekCards(stage);
  stage.prepend(diagram);
  const stripHost = doc.createElement('div');
  stripHost.className = 'code-strip';
  const strip = new CodeTrace(stripHost);
  scene.append(stage, stripHost);
  host.append(scene);

  const measure = new TextMeasure(probe);
  const layer = new SequenceLayer(select(g) as never, measure);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<IstekParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;

  /** Area of the stage (estimated where layout is unavailable). */
  function area(): { w: number; h: number } {
    const r = stage.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { w: Math.floor(r.width), h: Math.floor(r.height) };
    return { w: size!.w, h: Math.max(160, size!.h - (mode === 'ders' ? STRIP_FALLBACK_H : 0)) };
  }

  function draw(state: PlayerState<IstekParams>, cause: ChangeCause, instant: boolean): void {
    layer.interrupt();
    const v = deriveIstekView(state.params);
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    const a = area();
    const narrow = a.w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    const dw = narrow ? a.w : a.w - CARDS_W - GAP;
    const dh = narrow ? Math.min(NARROW_MAX, Math.max(NARROW_MIN, Math.floor(a.h * NARROW_SHARE))) : a.h;
    stage.style.setProperty('--cards-w', `${CARDS_W}px`);
    stage.style.setProperty('--diagram-h', `${dh}px`);
    svg.setAttribute('width', String(dw));
    svg.setAttribute('height', String(dh));
    svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
    layer.draw(v.sequence, { left: 0, top: 0, width: dw, height: dh }, ms, measure.fonts(mode).tick);
    cards.update(v);
    stripHost.hidden = mode !== 'ders';
    stripHost.toggleAttribute('data-empty', v.code.active.length === 0);
    strip.update({ ...v.code, window: STRIP_WINDOW });
    rendered = true;
  }

  function render(state: PlayerState<IstekParams>, cause: ChangeCause, instant: boolean): void {
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

/** Lab-only: the whole listing of Kod 1.5 under the step text, the running line highlighted. */
export function mountIstekExtra(el: HTMLElement, player: StepPlayer<IstekParams>): void {
  const trace = new CodeTrace(el);
  const sync = (): void => trace.update(deriveIstekView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
