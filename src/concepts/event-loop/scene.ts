import { select } from 'd3-selection';
import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { CodeTrace } from '../../core/plot/code-trace';
import { FlowGraphLayer, fitNode, type FlowNode } from '../../core/plot/flow-graph';
import { TextMeasure } from '../../core/plot/text-measure';
import { RING_LOOP_ROOM, layoutColumn, layoutRing } from './phases';
import { LoopBoard } from './scene-board';
import type { LoopParams } from './scenario';
import { deriveLoopView, type LoopView } from './view';
import './event-loop.css';

const NS = 'http://www.w3.org/2000/svg';
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/** Milliseconds a step change animates (boxes sliding, the token walking). */
const MS_STEP = 500;
/** Below this stage width (px) the boxes stack in one column. */
const NARROW = 700;
/** Height (px) reserved for the Ders code strip when layout is unavailable (title + seven lines). */
const STRIP_FALLBACK_H = 210;
/** Lines of code the Ders strip shows either side of the running one (a phone shows fewer). */
const STRIP_WINDOW = 3;
const STRIP_WINDOW_NARROW = 1;
/** Width of a phase box as a share of the drawing, within these bounds (px). */
const PHASE_SHARE = 0.27;
const PHASE_MIN = 130;
const PHASE_MAX = 240;
/** Phone column: widest box, room (px) kept at the sides for the closing edge and poll's loop, and the column's shift right. */
const COLUMN_MAX = 300;
const COLUMN_SIDE = 100;
const COLUMN_SHIFT = 20;
/** How far (px) beyond the column's box edge the closing edge bows out. */
const COLUMN_BOW = 30;
/** The phase drawing is at least this tall (px); the stage scrolls below that. */
const RING_MIN_H = 300;
/** Average glyph width of the notes, in em, and their line height, for estimating how tall they wrap. */
const NOTE_EM = 0.55;
const NOTE_LINE = 1.45;

const raf = (cb: () => void): number =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
const cancelRaf = (id: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
};

/** Fills `p` with `text`, the `backtick` spans as <code>. */
function richText(p: HTMLElement, text: string): void {
  const doc = p.ownerDocument;
  p.replaceChildren(
    ...text.split('`').map((part, i) => {
      if (i % 2 === 0) return doc.createTextNode(part);
      const c = doc.createElement('code');
      c.textContent = part;
      return c;
    }),
  );
}

let sceneCount = 0;

/**
 * Scene of the event-loop page: the queue board (HTML) or, on the phases step, the phase ring (SVG) with its
 * notes underneath; in Ders the code strip under the stage. Updates coalesce into one frame; Lab control
 * changes render without animation. Every render is a `loop-render` performance measure.
 */
export function mountLoopScene(
  host: HTMLElement,
  player: StepPlayer<LoopParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const doc = host.ownerDocument;
  const scene = doc.createElement('div');
  scene.className = 'loop-scene';
  const stage = doc.createElement('div');
  stage.className = 'loop-stage';
  const board = new LoopBoard(stage);
  const asamalar = doc.createElement('div');
  asamalar.className = 'asamalar';
  asamalar.hidden = true;
  const sema = doc.createElement('div');
  sema.className = 'asamalar-sema';
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  sema.append(svg);
  const noteHost = doc.createElement('div');
  noteHost.className = 'asamalar-notlar';
  asamalar.append(sema, noteHost);
  stage.append(asamalar);
  const stripHost = doc.createElement('div');
  stripHost.className = 'code-strip';
  const strip = new CodeTrace(stripHost);
  scene.append(stage, stripHost);
  host.append(scene);

  const measure = new TextMeasure(probe);
  const layer = new FlowGraphLayer(select(g) as never, measure);
  // poll's self-loop is not an edge of the graph (a flow edge needs two nodes): it gets its own arrow head and group
  const markerId = `poll-dongu-ok-${sceneCount++}`;
  const defs = doc.createElementNS(NS, 'defs');
  const marker = doc.createElementNS(NS, 'marker');
  const markerAttrs = { id: markerId, viewBox: '0 0 10 10', refX: '9', refY: '5', markerUnits: 'userSpaceOnUse', markerWidth: '11', markerHeight: '11', orient: 'auto' };
  for (const [k, v] of Object.entries(markerAttrs)) marker.setAttribute(k, v);
  const arrow = doc.createElementNS(NS, 'path');
  arrow.setAttribute('class', 'flow-arrow arrow-forward');
  arrow.setAttribute('d', 'M0,0L10,5L0,10Z');
  marker.append(arrow);
  defs.append(marker);
  const loopG = doc.createElementNS(NS, 'g');
  loopG.setAttribute('class', 'poll-dongu-katman');
  svg.append(defs, loopG);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let pending: { s: PlayerState<LoopParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;

  /** Area of the stage (estimated where layout is unavailable). */
  function area(stripShown: boolean): { w: number; h: number } {
    const r = stage.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { w: Math.floor(r.width), h: Math.floor(r.height) };
    return { w: size!.w, h: Math.max(160, size!.h - (stripShown ? STRIP_FALLBACK_H : 0)) };
  }

  function drawPhases(spec: NonNullable<LoopView['phases']>, notes: string[], a: { w: number; h: number }, tick: number, ms: number, narrow: boolean): void {
    const dw = a.w;
    // a phone has no room for a ring: one column, the closing edge bowing out on the left and poll's loop on the right
    const nw = narrow ? Math.max(PHASE_MIN, Math.min(COLUMN_MAX, dw - COLUMN_SIDE)) : Math.max(PHASE_MIN, Math.min(PHASE_MAX, Math.floor(dw * PHASE_SHARE)));
    const sized = spec.nodes.map((n) => ({ ...n, w: nw }));
    const fitted = sized.map((n) => fitNode(n, measure, tick).h);
    const nh = Math.max(...fitted);
    let nodes: FlowNode[];
    let dh: number;
    let edges = spec.edges;
    if (narrow) {
      const col = layoutColumn(sized.map((n, i) => ({ ...n, h: fitted[i] })), dw / 2 + COLUMN_SHIFT);
      nodes = col.nodes;
      dh = col.height;
      edges = edges.map((e) => (e.id === 'close-timers' ? { ...e, bend: -(nw / 2 + COLUMN_BOW) } : e));
    } else {
      const noteLines = Math.ceil(notes.join(' ').length / Math.max(8, a.w / (tick * NOTE_EM))) + notes.length;
      dh = Math.max(RING_MIN_H, a.h - Math.ceil(noteLines * tick * NOTE_LINE) - 16);
      nodes = layoutRing(sized.map((n) => ({ ...n, h: nh })), dw, dh);
    }
    svg.setAttribute('width', String(dw));
    svg.setAttribute('height', String(dh));
    svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
    layer.draw({ ...spec, nodes, edges }, ms, tick);
    // the self-loop: out of poll's bottom edge and back in (ring) or out of its right edge and back in (column)
    const box = layer.nodeBox('poll');
    const depth = (RING_LOOP_ROOM - 6) * (4 / 3);
    let d: string;
    if (narrow) {
      const cy = (box.t + box.b) / 2;
      const half = (box.b - box.t) * 0.18;
      d = `M${box.r},${cy - half}C${box.r + depth},${cy - half} ${box.r + depth},${cy + half} ${box.r},${cy + half}`;
    } else {
      const cx = (box.l + box.r) / 2;
      const half = (box.r - box.l) * 0.18;
      d = `M${cx + half},${box.b}C${cx + half},${box.b + depth} ${cx - half},${box.b + depth} ${cx - half},${box.b}`;
    }
    select(loopG)
      .selectAll('path')
      .data([0])
      .join('path')
      .attr('class', 'flow-edge kind-forward poll-dongu')
      .attr('marker-end', `url(#${markerId})`)
      .attr('d', d);
    noteHost.replaceChildren(
      ...notes.map((t) => {
        const p = doc.createElement('p');
        p.className = 'not';
        richText(p, t);
        return p;
      }),
    );
  }

  function draw(state: PlayerState<LoopParams>, cause: ChangeCause, instant: boolean): void {
    layer.interrupt();
    const v = deriveLoopView(state.params);
    const ms = ds > 0 && !instant && cause !== 'param' ? MS_STEP * ds : 0;
    const phases = v.phases !== null;
    // the phases step has no code line to follow: the whole height goes to the ring
    const stripShown = mode === 'ders' && !phases;
    const a = area(stripShown);
    const tick = measure.fonts(mode).tick;
    const narrow = a.w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    board.root.hidden = phases;
    asamalar.hidden = !phases;
    if (v.phases) {
      drawPhases(v.phases, v.notes, a, tick, ms, narrow);
    } else {
      layer.clear();
      loopG.replaceChildren();
      noteHost.replaceChildren();
      board.update(v, ms);
    }
    stripHost.hidden = !stripShown;
    const window = narrow ? STRIP_WINDOW_NARROW : STRIP_WINDOW;
    stripHost.style.setProperty('--strip-lines', String(window * 2 + 1));
    stripHost.toggleAttribute('data-empty', v.code.active.length === 0);
    // before the first line runs nothing is highlighted: the strip keeps its height but lists nothing
    strip.update({ ...v.code, lines: v.code.active.length === 0 ? [] : v.code.lines, window });
    rendered = true;
  }

  function render(state: PlayerState<LoopParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const canMeasure = typeof performance !== 'undefined' && typeof performance.measure === 'function';
    if (canMeasure) performance.mark('loop-render-start');
    draw(state, cause, instant);
    if (canMeasure) {
      performance.measure('loop-render', 'loop-render-start');
      performance.clearMarks('loop-render-start');
    }
  }

  function flush(): void {
    rafId = null;
    const p = pending;
    pending = null;
    if (p) render(p.s, p.cause, false);
  }

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
      board.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing of the chosen program under the step text, the running line highlighted. */
export function mountLoopExtra(el: HTMLElement, player: StepPlayer<LoopParams>): void {
  const trace = new CodeTrace(el);
  const sync = (): void => trace.update(deriveLoopView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
