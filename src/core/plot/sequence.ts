import type { Selection } from 'd3-selection';
import './sequence.css';
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
}

const MAX_ROWS = 8;
const LINE_K = 1.2;
const PAD = 6;
const TOKEN_R = 6;
const RESPONSE_DASH = '7 5';
const NOTE_H_LINES_PAD = 8;
/** Clear space (px) kept between the content of two neighbouring rows. */
const ROW_CLEAR = 4;
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
    this.drawLanes(spec, lay, ms, fontPx);
    this.drawMessages(spec, lay, ms, fontPx);
    this.drawStop(spec, lay, ms);
    this.drawToken(spec, lay, ms, fontPx);
  }

  private layout(spec: SequenceSpec, box: Rect, fontPx: number): Layout {
    const n = spec.lanes.length;
    const gap = n > 0 ? box.width / n : box.width;
    const xs = new Map(spec.lanes.map((l, i) => [l.id, box.left + gap * (i + 0.5)]));
    const lh = fontPx * LINE_K;
    const headLines = Math.max(0, ...spec.lanes.map((l) => this.laneLines(l, gap, fontPx).length + (l.sub ? 1 : 0)));
    const headerBottom = box.top + headLines * lh + 2 * PAD;
    const bottom = box.top + box.height;
    // rows sit on an even grid, pushed down where a row's content (note box, wrapped label) would touch the one above
    const tail = lh + NOTE_H_LINES_PAD / 2;
    const rowH = Math.max(0, (bottom - headerBottom - tail) / MAX_ROWS);
    const lay: Layout = { xs, gap, headerBottom, rowH, bottom, left: box.left, right: box.left + box.width, ys: [], lastBelow: 0 };
    const first = Math.max(0, spec.messages.length - MAX_ROWS);
    let prevY = 0;
    let prevBelow = 0;
    spec.messages.forEach((m, i) => {
      const row = Math.max(0, i - first);
      const { above, below } = this.extent(m, lay, fontPx);
      const grid = headerBottom + rowH * (row + 0.75);
      const y = i <= first ? Math.max(grid, headerBottom + above + ROW_CLEAR) : Math.max(grid, prevY + prevBelow + above + ROW_CLEAR);
      lay.ys.push(y);
      prevY = y;
      prevBelow = below;
    });
    lay.lastBelow = prevBelow;
    return lay;
  }

  /** Lines a note's text wraps to; a note may span a couple of lanes, so a short check stays on one line even on a phone. */
  private noteLines(label: string, lay: Layout, fontPx: number): string[] {
    return this.measure.wrap(label, Math.min(lay.gap * 2.4, lay.right - lay.left) - 2 * PAD, 'seq-msg-label', fontPx);
  }

  /** Lines an arrow's label wraps to. */
  private arrowLines(m: Message, lay: Layout, fontPx: number): string[] {
    const span = Math.abs((lay.xs.get(m.to) ?? 0) - (lay.xs.get(m.from) ?? 0));
    return this.measure.wrap(m.label, Math.max(lay.gap - 2 * PAD, span - 2 * PAD), 'seq-msg-label', fontPx);
  }

  /** Room (px) a message needs above and below its line. */
  private extent(m: Message, lay: Layout, fontPx: number): { above: number; below: number } {
    const lh = fontPx * LINE_K;
    if (m.kind === 'note') {
      const half = (this.noteLines(m.label, lay, fontPx).length * lh + NOTE_H_LINES_PAD) / 2;
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
    const n = spec.messages.length;
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
      .attr('class', (d, i) => `seq-msg${d.tone === 'alarm' ? ' alarm' : d.tone === 'ok' ? ' ok' : ''}${n - i > MAX_ROWS ? ' old' : ''}`);
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
        const lines = this.noteLines(d.label, lay, fontPx);
        const w = this.measure.maxWidth(lines, 'seq-msg-label', fontPx) + 2 * PAD;
        const h = lines.length * lh + NOTE_H_LINES_PAD;
        const r = g.querySelector('rect')!;
        // a note on an outer lane stays inside the diagram
        const cx = Math.max(lay.left + 2 + w / 2, Math.min(lay.right - 2 - w / 2, x1));
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
    let g = this.stopG.select<SVGGElement>('g.seq-stop');
    if (g.empty()) {
      g = this.stopG.append('g').attr('class', 'seq-stop').attr('transform', `translate(${r1(x)},${r1(y)})`);
      g.append('circle').attr('r', 8);
      g.append('path').attr('d', 'M-4,-4L4,4M4,-4L-4,4');
    }
    tr(g, 'seq-stop', ms).attr('transform', `translate(${r1(x)},${r1(y)})`);
  }

  private drawToken(spec: SequenceSpec, lay: Layout, ms: number, fontPx: number): void {
    const n = spec.messages.length;
    const i = spec.messages.findIndex((m) => m.id === spec.active);
    if (i < 0 || n - i > MAX_ROWS) {
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
      const lines = this.noteLines(m.label, lay, fontPx);
      const w = this.measure.maxWidth(lines, 'seq-msg-label', fontPx) + 2 * PAD;
      const cx = Math.max(lay.left + 2 + w / 2, Math.min(lay.right - 2 - w / 2, x1));
      x1 = x2 = Math.max(lay.left + TOKEN_R + 1, cx - w / 2);
      cy = y - (lines.length * fontPx * LINE_K + NOTE_H_LINES_PAD) / 2;
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
