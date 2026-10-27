import { select } from 'd3-selection';
import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { CodeTrace } from '../../core/plot/code-trace';
import { FlowGraphLayer, fitNode, type FlowNode } from '../../core/plot/flow-graph';
import type { Box } from '../../core/plot/label-place';
import { TextMeasure } from '../../core/plot/text-measure';
import { EXIT_LABEL, POLL_LOOP_LABEL, RING_LOOP_ROOM, layoutColumn, layoutRing } from './phases';
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
const COLUMN_SIDE = 80;
const COLUMN_SHIFT = 0;
/** Gap (px) between the boxes of the phone column: just room for an arrow (a longer label pushes the boxes below apart). */
const COLUMN_GAP = 16;
/** How far (px) beyond the column's box edge the closing edge bows out. */
const COLUMN_BOW = 30;
/** The phase drawing is at least this tall (px); the stage scrolls below that. */
const RING_MIN_H = 300;
/** Average glyph width of the notes, in em, and their line height, for estimating how tall they wrap. */
const NOTE_EM = 0.55;
const NOTE_LINE = 1.45;
/** Exit edge: the mark's radius, its inset from close's left edge (ring) or right of the centre line (phone), and its height above close's box. */
const EXIT_R = 6;
const EXIT_INSET = 18;
const EXIT_INSET_COLUMN = 10;
const EXIT_UP = 20;
/** On the ring the exit mark sits this far above close's box: clear of the label of the closing edge. */
const EXIT_UP_RING = 44;
/** How far (px) below poll's box its self-loop label starts (ring), and the label's line height in ticks. */
const LOOP_LABEL_DROP = 30;
const LABEL_LINE = 1.25;

/** Most `loop-render` measures kept in the performance buffer. */
const MEASURE_CAP = 300;

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
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Event loop aşamaları: timers, pending callbacks, poll, check ve close callbacks; poll kendine döner, close turu yeniden başlatır veya süreci sonlandırır');
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
  const exitG = doc.createElementNS(NS, 'g');
  exitG.setAttribute('class', 'cikis-katman');
  svg.append(defs, loopG, exitG);

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

  /** x of the column's centre line. */
  const nodeCx = (ns: FlowNode[]): number => ns[0].x;

  function drawPhases(spec: NonNullable<LoopView['phases']>, notes: string[], a: { w: number; h: number }, tick: number, ms: number, narrow: boolean): void {
    const dw = a.w;
    // a phone has no room for a ring: one column, the closing edge bowing out on the left and poll's loop on the right
    const nw = narrow ? Math.max(PHASE_MIN, Math.min(COLUMN_MAX, dw - COLUMN_SIDE)) : Math.max(PHASE_MIN, Math.min(PHASE_MAX, Math.floor(dw * PHASE_SHARE)));
    // on a phone the boxes are as low as their text: the labels below need the height
    const sized = spec.nodes.map((n) => ({ ...n, w: nw, h: narrow ? 0 : n.h }));
    const fitted = sized.map((n) => fitNode(n, measure, tick).h);
    const nh = Math.max(...fitted);
    let nodes: FlowNode[];
    let dh: number;
    let edges = spec.edges;
    const lh = tick * LABEL_LINE;
    // poll's self-loop label: centred under poll on the ring, right of the column's centre line on a phone (wrapped to fit)
    const loopMax = narrow ? Math.max(40, dw - 4 - (dw / 2 + COLUMN_SHIFT + 8)) : Infinity;
    const loopLines = narrow ? measure.wrap(POLL_LOOP_LABEL, loopMax, 'flow-edge-label', tick) : [POLL_LOOP_LABEL];
    // on a phone the closing edge's label is wrapped into the gap left of the check-to-close edge
    const closeLabel = spec.edges.find((e) => e.id === 'close-timers')!.label!;
    const closeMax = Math.max(40, dw / 2 + COLUMN_SHIFT - 8 - 4);
    const closeLines = narrow ? measure.wrap(closeLabel, closeMax, 'flow-edge-label', tick) : [];
    // on a phone the exit label shares that gap, right of the check-to-close edge
    const exitX0 = dw / 2 + COLUMN_SHIFT + EXIT_INSET_COLUMN;
    const exitLines = narrow ? measure.wrap(EXIT_LABEL, Math.max(40, dw - 4 - (exitX0 + EXIT_R + 6)), 'flow-edge-label', tick) : [EXIT_LABEL];
    if (narrow) {
      const col = layoutColumn(sized.map((n, i) => ({ ...n, h: fitted[i] })), dw / 2 + COLUMN_SHIFT, undefined, COLUMN_GAP);
      const pollI = col.nodes.findIndex((n) => n.id === 'poll');
      const checkI = col.nodes.findIndex((n) => n.id === 'check');
      // a label that is taller than the gap between two boxes pushes the lower boxes down
      const shift = Math.max(0, Math.ceil(loopLines.length * lh) + 4 - COLUMN_GAP);
      const shiftClose = Math.max(0, Math.ceil(Math.max(closeLines.length, exitLines.length) * lh) + 4 - COLUMN_GAP);
      nodes = col.nodes.map((n, i) => ({ ...n, y: n.y + (i > pollI ? shift : 0) + (i > checkI ? shiftClose : 0) }));
      dh = col.height + shift + shiftClose;
      edges = edges.map((e) => (e.id === 'close-timers' ? { ...e, bend: -(nw / 2 + COLUMN_BOW), label: undefined } : e));
    } else {
      const noteLines = Math.ceil(notes.join(' ').length / Math.max(8, a.w / (tick * NOTE_EM))) + notes.length;
      dh = Math.max(RING_MIN_H, a.h - Math.ceil(noteLines * tick * NOTE_LINE) - 16);
      nodes = layoutRing(sized.map((n) => ({ ...n, h: nh })), dw, dh);
    }
    svg.setAttribute('width', String(dw));
    svg.setAttribute('height', String(dh));
    svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
    const boxOf = (id: string): Box => {
      const n = nodes.find((m) => m.id === id)!;
      return { l: n.x - n.w / 2, t: n.y - n.h / 2, r: n.x + n.w / 2, b: n.y + n.h / 2 };
    };
    // the loop label and the exit edge are drawn here, so the flow layer is told to keep its edge labels clear of them
    const pollBox = boxOf('poll');
    const closeBox = boxOf('close');
    const loopX = narrow ? (pollBox.l + pollBox.r) / 2 + 8 : (pollBox.l + pollBox.r) / 2;
    const loopY = pollBox.b + (narrow ? 0 : LOOP_LABEL_DROP);
    const loopW = Math.max(...loopLines.map((l) => measure.width(l, 'flow-edge-label', tick)));
    const loopArea: Box = { l: narrow ? loopX : loopX - loopW / 2, t: loopY, r: narrow ? loopX + loopW : loopX + loopW / 2, b: loopY + loopLines.length * lh + 4 };
    const exitX = narrow ? exitX0 : closeBox.l + EXIT_INSET;
    const exitY = closeBox.t - (narrow ? EXIT_UP : EXIT_UP_RING);
    const exitW = Math.max(...exitLines.map((l) => measure.width(l, 'flow-edge-label', tick)));
    const exitArea: Box = { l: exitX - EXIT_R, t: exitY - (exitLines.length * lh) / 2, r: exitX + EXIT_R + 8 + exitW, b: exitY + (exitLines.length * lh) / 2 };
    layer.draw({ ...spec, nodes, edges, avoid: [loopArea, exitArea] }, ms, tick);
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
    const path = (cls: string, pd: string): SVGPathElement => {
      const p = doc.createElementNS(NS, 'path');
      p.setAttribute('class', cls);
      p.setAttribute('marker-end', `url(#${markerId})`);
      p.setAttribute('d', pd);
      return p;
    };
    const label = (x: number, y: number, anchor: string, lines: string[]): SVGTextElement => {
      const t = doc.createElementNS(NS, 'text');
      t.setAttribute('class', 'flow-edge-label');
      t.setAttribute('text-anchor', anchor);
      lines.forEach((line, i) => {
        const s = doc.createElementNS(NS, 'tspan');
        s.setAttribute('x', String(Math.round(x)));
        s.setAttribute('y', String(Math.round(y + tick * 0.9 + i * lh)));
        s.textContent = line;
        t.append(s);
      });
      return t;
    };
    loopG.replaceChildren(path('flow-edge kind-forward poll-dongu', d), label(loopX, loopY, narrow ? 'start' : 'middle', loopLines));
    // the exit edge: out of close's box to the end mark, labelled as in the figure
    const mark = doc.createElementNS(NS, 'circle');
    mark.setAttribute('class', 'cikis-son');
    mark.setAttribute('cx', String(Math.round(exitX)));
    mark.setAttribute('cy', String(Math.round(exitY)));
    mark.setAttribute('r', String(EXIT_R));
    const from = closeBox.t;
    const to = exitY + EXIT_R;
    const exitText = label(exitX + EXIT_R + 6, exitY - (exitLines.length * lh) / 2, 'start', exitLines);
    const closeText = narrow ? [label(nodeCx(nodes) - 8, boxOf('check').b + 4, 'end', closeLines)] : [];
    exitG.replaceChildren(path('flow-edge kind-forward cikis', `M${Math.round(exitX)},${Math.round(from)}L${Math.round(exitX)},${Math.round(to)}`), mark, exitText, ...closeText);
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
    // visibility first: the stage is measured with what it will really hold
    board.root.hidden = phases;
    asamalar.hidden = !phases;
    stripHost.hidden = !stripShown;
    const a = area(stripShown);
    const tick = measure.fonts(mode).tick;
    const narrow = a.w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    if (v.phases) {
      drawPhases(v.phases, v.notes, a, tick, ms, narrow);
    } else {
      layer.clear();
      loopG.replaceChildren();
      exitG.replaceChildren();
      noteHost.replaceChildren();
      board.update(v, ms);
    }
    const window = narrow ? STRIP_WINDOW_NARROW : STRIP_WINDOW;
    stripHost.style.setProperty('--strip-lines', String(window * 2 + 1));
    // before the first line runs nothing is highlighted: the strip shows the listing's first lines
    strip.update({ ...v.code, lines: v.code.active.length === 0 ? v.code.lines.slice(0, window * 2 + 1) : v.code.lines, window });
    rendered = true;
  }

  function render(state: PlayerState<LoopParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    const canMeasure = typeof performance !== 'undefined' && typeof performance.measure === 'function';
    if (canMeasure) performance.mark('loop-render-start');
    try {
      draw(state, cause, instant);
    } finally {
      if (canMeasure) {
        performance.measure('loop-render', 'loop-render-start');
        performance.clearMarks('loop-render-start');
        // a drag renders ~60 times a second: keep the buffer bounded (Task 9 reads the last <= MEASURE_CAP)
        if (performance.getEntriesByName('loop-render', 'measure').length > MEASURE_CAP) performance.clearMeasures('loop-render');
      }
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
