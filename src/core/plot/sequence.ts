import type { Selection } from 'd3-selection';
import './sequence.css';
import { breakWord } from './lane-words';
import { r1 } from './marks';
import type { TextMeasure } from './text-measure';
import { tr } from './transition';
import type { Rect } from './viewport';

type G = Selection<SVGGElement, unknown, null, undefined>;

export interface Lane {
  id: string;
  label: string[];
  sub?: string;
}
/** `note` is a self-message drawn as a box on its lane (a rule check). */
export type MsgKind = 'request' | 'response' | 'note';
export interface Message {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: MsgKind;
  tone?: 'ok' | 'alarm';
}
export interface SequenceSpec {
  lanes: Lane[];
  messages: Message[];
  /** Message the token travels along. */
  active?: string;
  /** Lane that gets a stop mark (the flow ends there). */
  stopAt?: string;
  /** Lane ids drawn faded. */
  dim?: string[];
  /** Stop mark look: 'alarm' (red cross, default) or 'ok' (green return mark, the flow ended as intended). */
  stopTone?: 'alarm' | 'ok';
  /** Written to the nearest `<svg>` as `role="img"` + `aria-label`. */
  ariaLabel?: string;
}

const MAX_ROWS = 8;
const LINE_K = 1.2;
const PAD = 6;
const TOKEN_R = 6;
const RESPONSE_DASH = '7 5';
const NOTE_H_LINES_PAD = 8;
/** Widest a note may wrap, in lane gaps, and the space (px) kept between a note and the diagram edge. */
const NOTE_LANES = 1.8;
const NOTE_INSET = TOKEN_R + 4;
/** Clear space (px) kept between the content of two neighbouring rows. */
const ROW_CLEAR = 4;
/** The least clear space (px) between packed rows before an older row is faded out instead. */
const MIN_ROW_CLEAR = 1;
/** Room (px) kept under the last row's content for the stop mark (its circle, r 8, sits at least 2 px below). */
const STOP_ROOM = 18;
let layerCount = 0;

interface Layout {
  xs: Map<string, number>;
  gap: number;
  headerBottom: number;
  rowH: number;
  bottom: number;
  left: number;
  right: number;
  /** Centre line (y) of every message, in spec order; hidden older ones share the first visible row. */
  ys: number[];
  /** Room (px) the last row's message needs below its line. */
  lastBelow: number;
  /** Index of the first message drawn; the ones before it are faded out as `old`. */
  first: number;
}

/**
 * Sequence diagram: lanes with lifelines, request (solid) / response (dashed) arrows and note boxes in rows,
 * a token travelling along the active message, a stop mark. Redraws update in place (keyed by id).
 * Colours live in sequence.css.
 */
export class SequenceLayer {
  private readonly lanesG: G;
  private readonly msgsG: G;
  private readonly stopG: G;
  private readonly tokenG: G;
  private readonly prefix = `seq${layerCount++}`;
  private xs = new Map<string, number>();

  constructor(
    parent: G,
    private readonly measure: TextMeasure,
  ) {
    const defs = parent.append('defs');
    for (const k of ['plain', 'alarm', 'ok']) {
      defs.append('marker')
        .attr('id', `${this.prefix}-${k}`)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 9)
        .attr('refY', 5)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('markerWidth', 11)
        .attr('markerHeight', 11)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('class', `seq-arrow-head head-${k}`)
        .attr('d', 'M0,0L10,5L0,10Z');
    }
    this.lanesG = parent.append('g').attr('class', 'seq-lanes');
    this.msgsG = parent.append('g').attr('class', 'seq-msgs');
    this.stopG = parent.append('g').attr('class', 'seq-stops');
    this.tokenG = parent.append('g').attr('class', 'seq-token-layer');
  }

  /** x (px) of a lane's lifeline in the last draw (0 if unknown). */
  laneX(id: string): number {
    return this.xs.get(id) ?? 0;
  }

  draw(spec: SequenceSpec, box: Rect, ms: number, fontPx: number): void {
    const lay = this.layout(spec, box, fontPx);
    this.xs = lay.xs;
    this.label(spec);
    this.drawLanes(spec, lay, ms, fontPx);
    this.drawMessages(spec, lay, ms, fontPx);
    this.drawStop(spec, lay, ms);
    this.drawToken(spec, lay, ms, fontPx);
  }

  private label(spec: SequenceSpec): void {
    const svg = (this.lanesG.node() as Element | null)?.closest('svg');
    if (!svg) return;
    if (spec.ariaLabel === undefined) {
      svg.removeAttribute('role');
      svg.removeAttribute('aria-label');
      return;
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', spec.ariaLabel);
  }

  /**
   * Rows sit on an even grid (MAX_ROWS rows tall), pushed down where a row's content (note box, wrapped label)
   * would touch the one above. The rows must end inside the box, with room for the stop mark under the last one:
   * if they do not, the grid is first squeezed (down to rows packed by their content), then the clear space between
   * packed rows shrinks (down to MIN_ROW_CLEAR), and only if that does not fit either, one more older message is
   * faded out as `old` and the rest move up. The last message always stays.
   */
  private layout(spec: SequenceSpec, box: Rect, fontPx: number): Layout {
    const n = spec.lanes.length;
    const gap = n > 0 ? box.width / n : box.width;
    const xs = new Map(spec.lanes.map((l, i) => [l.id, box.left + gap * (i + 0.5)]));
    const lh = fontPx * LINE_K;
    const headLines = Math.max(0, ...spec.lanes.map((l) => this.laneLines(l, gap, fontPx).length + (l.sub ? 1 : 0)));
    const headerBottom = box.top + headLines * lh + 2 * PAD;
    const bottom = box.top + box.height;
    const tail = lh + NOTE_H_LINES_PAD / 2;
    const gridH = Math.max(0, (bottom - headerBottom - tail) / MAX_ROWS);
    const base: Layout = { xs, gap, headerBottom, rowH: gridH, bottom, left: box.left, right: box.left + box.width, ys: [], lastBelow: 0, first: 0 };
    const extents = spec.messages.map((m) => this.extent(m, base, fontPx));
    const room = spec.stopAt !== undefined ? STOP_ROOM : 0;
    const place = (first: number, rowH: number, clear = ROW_CLEAR): Layout => {
      const lay: Layout = { ...base, rowH, ys: [], first };
      let prevY = 0;
      let prevBelow = 0;
      extents.forEach(({ above, below }, i) => {
        const grid = headerBottom + rowH * (Math.max(0, i - first) + 0.75);
        const y = i <= first ? Math.max(grid, headerBottom + above + clear) : Math.max(grid, prevY + prevBelow + above + clear);
        lay.ys.push(y);
        prevY = y;
        prevBelow = below;
      });
      lay.lastBelow = prevBelow;
      return lay;
    };
    const fits = (lay: Layout): boolean => lay.ys.length === 0 || lay.ys[lay.ys.length - 1] + lay.lastBelow + room <= bottom;
    /** The largest value in [lo, hi] for which `at(value)` still fits (rows only move down as it grows). */
    const largest = (lo: number, hi: number, at: (v: number) => Layout): Layout => {
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (fits(at(mid))) lo = mid;
        else hi = mid;
      }
      return at(lo);
    };
    const last = Math.max(0, spec.messages.length - 1);
    for (let first = Math.max(0, spec.messages.length - MAX_ROWS); ; first++) {
      const even = place(first, gridH);
      if (fits(even)) return even;
      if (fits(place(first, 0))) return largest(0, gridH, (h) => place(first, h));
      const tight = place(first, 0, MIN_ROW_CLEAR);
      if (fits(tight)) return largest(MIN_ROW_CLEAR, ROW_CLEAR, (c) => place(first, 0, c));
      if (first >= last) return tight;
    }
  }

  /**
   * Box of a note on its lane: text wraps at no more than NOTE_LANES lane gaps, and the box is centred on its lane
   * unless that would push it out of the diagram; then it is shifted in by NOTE_INSET so its border and the token
   * on its corner stay fully visible.
   */
  private noteBox(m: Message, lay: Layout, fontPx: number): { lines: string[]; w: number; h: number; cx: number } {
    const lines = this.wrap(m.label, Math.min(lay.gap * NOTE_LANES, lay.right - lay.left - 2 * NOTE_INSET) - 2 * PAD, fontPx);
    const w = this.measure.maxWidth(lines, 'seq-msg-label', fontPx) + 2 * PAD;
    const h = lines.length * fontPx * LINE_K + NOTE_H_LINES_PAD;
    const lane = lay.xs.get(m.from) ?? 0;
    const cx = Math.max(lay.left + NOTE_INSET + w / 2, Math.min(lay.right - NOTE_INSET - w / 2, lane));
    return { lines, w, h, cx };
  }

  /**
   * Lines an arrow's label wraps to. A single word wider than the arrow may spill past its ends, as long as the
   * label (centred on the arrow) stays inside the diagram; only a wider one is broken.
   */
  private arrowLines(m: Message, lay: Layout, fontPx: number): string[] {
    const x1 = lay.xs.get(m.from) ?? 0;
    const x2 = lay.xs.get(m.to) ?? 0;
    const mid = (x1 + x2) / 2;
    const edge = 2 * Math.min(mid - lay.left, lay.right - mid) - 2 * PAD;
    return this.wrap(m.label, Math.max(lay.gap - 2 * PAD, Math.abs(x2 - x1) - 2 * PAD), fontPx, edge);
  }

  /**
   * Word wrap of a message label at `room` px; a single word wider than `hard` px (a long call that would leave the
   * diagram) is broken at camelCase, dot and after-`(` boundaries.
   */
  private wrap(text: string, room: number, fontPx: number, hard = room): string[] {
    const width = (t: string): number => this.measure.width(t, 'seq-msg-label', fontPx);
    return this.measure.wrap(text, room, 'seq-msg-label', fontPx).flatMap((line) => (width(line) > hard ? breakWord(line, hard, width) : [line]));
  }

  /** Room (px) a message needs above and below its line. */
  private extent(m: Message, lay: Layout, fontPx: number): { above: number; below: number } {
    const lh = fontPx * LINE_K;
    if (m.kind === 'note') {
      const half = this.noteBox(m, lay, fontPx).h / 2;
      return { above: half, below: half };
    }
    return { above: 6 + (this.arrowLines(m, lay, fontPx).length - 1) * lh + fontPx, below: TOKEN_R };
  }

  private laneLines(l: Lane, gap: number, fontPx: number): string[] {
    return l.label.flatMap((t) => this.measure.wrap(t, gap - 2 * PAD, 'seq-lane-label', fontPx));
  }

  private drawLanes(spec: SequenceSpec, lay: Layout, ms: number, fontPx: number): void {
    const dim = new Set(spec.dim ?? []);
    const lh = fontPx * LINE_K;
    const top = lay.headerBottom - 2 * PAD - Math.max(0, ...spec.lanes.map((l) => this.laneLines(l, lay.gap, fontPx).length + (l.sub ? 1 : 0))) * lh;
    const sel = this.lanesG.selectAll<SVGGElement, Lane>('g.seq-lane').data(spec.lanes, (d) => d.id);
    sel.exit().remove();
    const enter = sel.enter().append('g').attr('data-id', (d) => d.id);
    enter.append('line').attr('class', 'seq-lifeline');
    enter.append('text').attr('class', 'seq-lane-label').attr('text-anchor', 'middle');
    enter.append('text').attr('class', 'seq-lane-sub').attr('text-anchor', 'middle');
    enter.attr('transform', (d) => `translate(${r1(lay.xs.get(d.id)!)},0)`);
    const all = enter.merge(sel).attr('class', (d) => `seq-lane${dim.has(d.id) ? ' dim' : ''}`);
    tr(all, 'seq-lane', ms).attr('transform', (d) => `translate(${r1(lay.xs.get(d.id)!)},0)`);
    all.select('line.seq-lifeline').attr('x1', 0).attr('x2', 0).attr('y1', lay.headerBottom).attr('y2', lay.bottom);
    all.each((d, i, nodes) => {
      const g = nodes[i];
      const lines = this.laneLines(d, lay.gap, fontPx);
      const label = g.querySelector('text.seq-lane-label')!;
      label.replaceChildren();
      lines.forEach((line, k) => {
        const ts = g.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        ts.setAttribute('x', '0');
        ts.setAttribute('y', String(r1(top + PAD + (k + 0.8) * lh)));
        ts.textContent = line;
        label.append(ts);
      });
      const sub = g.querySelector('text.seq-lane-sub')!;
      sub.setAttribute('y', String(r1(top + PAD + (lines.length + 0.8) * lh)));
      sub.textContent = d.sub ?? '';
    });
  }

  private drawMessages(spec: SequenceSpec, lay: Layout, ms: number, fontPx: number): void {
    const index = new Map(spec.messages.map((m, i) => [m.id, i]));
    const y = (m: Message): number => lay.ys[index.get(m.id)!];
    const lh = fontPx * LINE_K;
    const sel = this.msgsG.selectAll<SVGGElement, Message>('g.seq-msg').data(spec.messages, (d) => `${d.id}|${d.kind}`);
    sel.exit().remove();
    const enter = sel.enter().append('g').attr('data-id', (d) => d.id);
    enter.each((d, i, nodes) => {
      const g = nodes[i];
      const doc = g.ownerDocument;
      const NS = 'http://www.w3.org/2000/svg';
      if (d.kind === 'note') {
        g.append(doc.createElementNS(NS, 'rect'));
        g.lastElementChild!.setAttribute('class', 'seq-note');
      } else {
        g.append(doc.createElementNS(NS, 'path'));
        g.lastElementChild!.setAttribute('class', 'seq-arrow');
      }
      const t = doc.createElementNS(NS, 'text');
      t.setAttribute('class', 'seq-msg-label');
      g.append(t);
    });
    enter.attr('transform', (d) => `translate(0,${r1(y(d))})`);
    const all = enter.merge(sel)
      .attr('data-kind', (d) => d.kind)
      .attr('class', (d, i) => `seq-msg${d.tone === 'alarm' ? ' alarm' : d.tone === 'ok' ? ' ok' : ''}${i < lay.first ? ' old' : ''}`);
    tr(all, 'seq-msg', ms).attr('transform', (d) => `translate(0,${r1(y(d))})`);

    all.each((d, i, nodes) => {
      const g = nodes[i];
      const label = g.querySelector('text.seq-msg-label')!;
      label.replaceChildren();
      const x1 = lay.xs.get(d.from) ?? 0;
      const x2 = lay.xs.get(d.to) ?? 0;
      const addLines = (lines: string[], cx: number, y0: number, anchor: string): void => {
        label.setAttribute('text-anchor', anchor);
        lines.forEach((line, k) => {
          const ts = g.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          ts.setAttribute('x', String(r1(cx)));
          ts.setAttribute('y', String(r1(y0 + k * lh)));
          ts.textContent = line;
          label.append(ts);
        });
      };
      if (d.kind === 'note') {
        const { lines, w, h, cx } = this.noteBox(d, lay, fontPx);
        const r = g.querySelector('rect')!;
        r.setAttribute('x', String(r1(cx - w / 2)));
        r.setAttribute('y', String(r1(-h / 2)));
        r.setAttribute('width', String(r1(w)));
        r.setAttribute('height', String(r1(h)));
        r.setAttribute('rx', '4');
        addLines(lines, cx, -((lines.length - 1) * lh) / 2 + fontPx * 0.35, 'middle');
        return;
      }
      const path = g.querySelector('path.seq-arrow')!;
      path.setAttribute('d', `M${r1(x1)},0L${r1(x2)},0`);
      path.setAttribute('marker-end', `url(#${this.prefix}-${d.tone ?? 'plain'})`);
      if (d.kind === 'response') path.setAttribute('stroke-dasharray', RESPONSE_DASH);
      else path.removeAttribute('stroke-dasharray');
      const lines = this.arrowLines(d, lay, fontPx);
      addLines(lines, (x1 + x2) / 2, -6 - (lines.length - 1) * lh, 'middle');
    });
  }

  private drawStop(spec: SequenceSpec, lay: Layout, ms: number): void {
    const x = spec.stopAt ? lay.xs.get(spec.stopAt) : undefined;
    if (x === undefined) {
      this.stopG.selectAll('*').remove();
      return;
    }
    const last = lay.ys.length > 0 ? lay.ys[lay.ys.length - 1] : lay.headerBottom;
    const y = Math.min(lay.bottom - 8, last + Math.max(lay.rowH / 2, lay.lastBelow + 14));
    const tone = spec.stopTone === 'ok' ? 'ok' : 'alarm';
    let g = this.stopG.select<SVGGElement>('g.seq-stop');
    if (!g.empty() && g.attr('data-tone') !== tone) {
      g.remove();
      g = this.stopG.select<SVGGElement>('g.seq-stop');
    }
    if (g.empty()) {
      g = this.stopG.append('g').attr('class', tone === 'ok' ? 'seq-stop ok' : 'seq-stop').attr('data-tone', tone).attr('transform', `translate(${r1(x)},${r1(y)})`);
      if (tone === 'ok') {
        // a green return mark: the flow came back with its answer
        g.append('path').attr('class', 'seq-stop-return').attr('d', 'M-8,0H6M-2,-6L-8,0L-2,6M6,-7V0');
      } else {
        g.append('circle').attr('r', 8);
        g.append('path').attr('d', 'M-4,-4L4,4M4,-4L-4,4');
      }
    }
    tr(g, 'seq-stop', ms).attr('transform', `translate(${r1(x)},${r1(y)})`);
  }

  private drawToken(spec: SequenceSpec, lay: Layout, ms: number, fontPx: number): void {
    const i = spec.messages.findIndex((m) => m.id === spec.active);
    if (i < 0 || i < lay.first) {
      this.tokenG.selectAll('*').interrupt('seq-token').remove();
      return;
    }
    const m = spec.messages[i];
    const y = lay.ys[i];
    let x1 = lay.xs.get(m.from) ?? 0;
    let x2 = lay.xs.get(m.to) ?? 0;
    let cy = y;
    if (m.kind === 'note') {
      // the token marks a note on its top-left corner, off the text
      const box = this.noteBox(m, lay, fontPx);
      x1 = x2 = box.cx - box.w / 2;
      cy = y - box.h / 2;
    }
    let c = this.tokenG.select<SVGCircleElement>('circle.seq-token');
    const fresh = c.empty();
    if (fresh) c = this.tokenG.append('circle').attr('class', 'seq-token').attr('r', TOKEN_R);
    c.interrupt('seq-token');
    if (ms > 0) {
      c.attr('cx', r1(x1)).attr('cy', r1(cy));
      tr(c, 'seq-token', ms).attr('cx', r1(x2));
    } else {
      c.attr('cx', r1(x2)).attr('cy', r1(cy));
    }
  }

  /** Stops every running seq-* transition, leaving things where they are. */
  interrupt(): void {
    for (const g of [this.lanesG, this.msgsG, this.stopG, this.tokenG]) {
      g.selectAll('*').interrupt('seq-lane').interrupt('seq-msg').interrupt('seq-stop').interrupt('seq-token');
    }
  }

  clear(): void {
    this.interrupt();
    for (const g of [this.lanesG, this.msgsG, this.stopG, this.tokenG]) g.selectAll('*').remove();
    this.xs = new Map();
  }
}
