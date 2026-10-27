import { scaleLinear } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import { MARK, NAVY, r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { Rect } from '../../core/plot/viewport';
import type { Bant, TimelineSpec } from './view';

const NS = 'http://www.w3.org/2000/svg';
/** Dot radius (px). */
const R = 6;
/** Space (px) kept between two stacked dots; and between a row edge and its dots / band. */
const GAP = 2;
const ROW_PAD = 4;
const TOP = 6;
/** Shown when there is nothing to draw yet (intro and summary): the axis still spans one default window. */
const BOS_MS = 60_000;

interface Yerlesim { t: number; ip: string; izin: boolean; etkin: boolean; kat: number; i: number }

/**
 * The timeline of the rate-limiting page: seconds on the x axis, one row per ip, a light band for every window and a
 * dot (radius 6) for every request: accepted `MARK[0]`, refused (429) `MARK[1]`; the last request has a ring. Dots of
 * one row that would touch are stacked upward. `update` re-joins everything with d3, so repeated calls never add elements.
 */
export class TimelineLayer {
  private readonly root: Selection<SVGGElement, unknown, null, undefined>;

  constructor(svg: SVGSVGElement, private readonly measure: TextMeasure) {
    const g = svg.ownerDocument.createElementNS(NS, 'g');
    g.setAttribute('class', 'rate-timeline');
    svg.append(g);
    this.root = select(g);
    for (const c of ['rate-axis', 'rate-rows', 'rate-bands', 'rate-dots']) this.root.append('g').attr('class', c);
  }

  update(spec: TimelineSpec, rect: Rect, ms: number): void {
    const tick = this.measure.fontPx('tick', 13);
    const bos = spec.ipler.length === 0;
    const xMaxMs = bos ? BOS_MS : spec.xMax;
    const etiketW = Math.ceil(this.measure.maxWidth([...spec.ipler], 'tick', tick)) + 10;
    const sonEtiket = `${xMaxMs / 1000} s`;
    const sonW = this.measure.width(sonEtiket, 'tick', tick);
    const sagPay = Math.ceil(sonW / 2) + 2;
    const eksenH = Math.ceil(tick * 1.7);
    const sol = rect.left + etiketW;
    const sag = rect.left + rect.width - sagPay;
    const ust = rect.top + TOP;
    const alt = rect.top + rect.height - eksenH;
    const x = scaleLinear().domain([0, xMaxMs / 1000]).range([sol + R + 1, Math.max(sol + R + 2, sag)]);
    const satirH = spec.ipler.length > 0 ? (alt - ust) / spec.ipler.length : alt - ust;
    const satirY = (ip: string): number => ust + spec.ipler.indexOf(ip) * satirH;

    // Axis: ticks at round seconds, as many as fit with room for their labels.
    const sigar = Math.max(2, Math.floor((x.range()[1] - x.range()[0]) / (sonW * 2.6)));
    const eksen = this.root.select<SVGGElement>('g.rate-axis');
    const ticks = eksen.selectAll<SVGGElement, number>('g.rate-tick').data(x.ticks(sigar), (d) => d);
    ticks.exit().remove();
    const yeniTick = ticks.enter().append('g').attr('class', 'rate-tick');
    yeniTick.append('line');
    yeniTick.append('text').attr('class', 'tick').attr('text-anchor', 'middle');
    const tumTick = yeniTick.merge(ticks);
    tumTick.attr('transform', (d) => `translate(${r1(x(d))},0)`);
    tumTick.select('line').attr('y1', ust).attr('y2', alt).attr('stroke', '#E3E9F0');
    tumTick.select('text').attr('y', r1(alt + tick * 1.25)).text((d) => `${d} s`);
    const taban = eksen.selectAll<SVGLineElement, number>('line.rate-taban').data([0]);
    taban.enter().append('line').attr('class', 'rate-taban').merge(taban)
      .attr('x1', sol).attr('x2', sag + 2).attr('y1', alt).attr('y2', alt).attr('stroke', NAVY);

    // Rows: separator and ip label.
    const satirlar = this.root.select<SVGGElement>('g.rate-rows').selectAll<SVGGElement, string>('g.rate-row').data([...spec.ipler], (d) => d);
    satirlar.exit().remove();
    const yeniSatir = satirlar.enter().append('g').attr('class', 'rate-row');
    yeniSatir.append('line');
    yeniSatir.append('text').attr('class', 'tick rate-ip').attr('text-anchor', 'start');
    const tumSatir = yeniSatir.merge(satirlar);
    tumSatir.select('line').attr('x1', sol).attr('x2', sag + 2).attr('y1', (d) => r1(satirY(d) + satirH)).attr('y2', (d) => r1(satirY(d) + satirH)).attr('stroke', '#C9D5E3');
    tumSatir.select('text').attr('x', rect.left + 2).attr('y', (d) => r1(satirY(d) + satirH / 2 + tick * 0.35)).text((d) => d);

    // Bands: one per window.
    const bantlar = this.root.select<SVGGElement>('g.rate-bands').selectAll<SVGRectElement, Bant>('rect.rate-bant').data([...(spec.bantlar as Bant[])], (d) => `${d.ip}|${d.bas}`);
    bantlar.exit().remove();
    const yeniBant = bantlar.enter().append('rect').attr('class', 'rate-bant').attr('fill', MARK[0]).attr('fill-opacity', 0.13).attr('stroke', MARK[0]).attr('stroke-opacity', 0.45).attr('rx', 4);
    yeniBant.merge(bantlar)
      .attr('x', (d) => r1(x(d.bas / 1000))).attr('width', (d) => r1(Math.max(0, x(d.son / 1000) - x(d.bas / 1000))))
      .attr('y', (d) => r1(satirY(d.ip) + ROW_PAD / 2)).attr('height', Math.max(0, r1(satirH - ROW_PAD)));

    // Dots.
    const yerlesim = this.yerles(spec, x, satirH);
    const noktalar = this.root.select<SVGGElement>('g.rate-dots').selectAll<SVGGElement, Yerlesim>('g.rate-nokta').data(yerlesim, (d) => d.i);
    noktalar.exit().remove();
    const yeni = noktalar.enter().append('g');
    yeni.append('circle').attr('class', 'rate-halka').attr('r', R + 4).attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 2);
    yeni.append('circle').attr('class', 'rate-dot').attr('r', R).attr('stroke', '#fff').attr('stroke-width', 1.5);
    const hepsi = yeni.merge(noktalar);
    hepsi.attr('class', (d) => `rate-nokta ${d.izin ? 'izin' : 'red'}`)
      .attr('transform', (d) => `translate(${r1(x(d.t / 1000))},${r1(satirY(d.ip) + satirH - ROW_PAD - R - d.kat * (2 * R + GAP))})`);
    hepsi.select('circle.rate-dot').attr('fill', (d) => (d.izin ? MARK[0] : MARK[1]));
    hepsi.select('circle.rate-halka').attr('display', (d) => (d.etkin ? null : 'none'));
    if (ms > 0) tr(yeni.style('opacity', 0), 'rate', ms).style('opacity', 1);
  }

  /** Request order is kept; a dot goes to the lowest level of its row whose last dot is at least a dot apart. */
  private yerles(spec: TimelineSpec, x: (s: number) => number, satirH: number): Yerlesim[] {
    const sonX = new Map<string, number[]>();
    const kapasite = Math.max(1, Math.floor((satirH - ROW_PAD * 2 + GAP) / (2 * R + GAP)));
    return spec.noktalar.map((n, i) => {
      const px = x(n.t / 1000);
      const katlar = sonX.get(n.ip) ?? [];
      let kat = katlar.findIndex((s) => px - s >= 2 * R + GAP);
      if (kat < 0) kat = katlar.length;
      katlar[kat] = px;
      sonX.set(n.ip, katlar);
      // a row too short for the stack lets the topmost dots overlap instead of leaving the row
      return { t: n.t, ip: n.ip, izin: n.izin, etkin: n.etkin, kat: Math.min(kat, kapasite - 1), i };
    });
  }

  destroy(): void {
    this.root.node()?.remove();
  }
}
