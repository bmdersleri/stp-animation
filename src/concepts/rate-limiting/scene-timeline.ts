import { scaleLinear } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import { MARK, NAVY, r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { Rect } from '../../core/plot/viewport';
import type { Bant, NoktaDurumu, TimelineSpec } from './view';

const NS = 'http://www.w3.org/2000/svg';
/** Dot radius (px). */
const R = 6;
/** Space (px) kept between two stacked dots; and between a row edge and its dots / band. */
const GAP = 2;
const ROW_PAD = 4;
const TOP = 6;
/** Shown when there is nothing to draw yet (intro and summary): the axis still spans one default window. */
const BOS_MS = 60_000;

/** `kat` is the level in the row's stack, `sira` the dot's offset from the row's centre line in dot steps. */
interface Yerlesim { t: number; ip: string; durum: NoktaDurumu; etkin: boolean; sira: number; i: number }
interface BantCizim extends Bant { no: number }

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

    // Bands: one per window; windows of one ip alternate in tone and have a clear edge, so adjacent ones stay apart.
    const sayac = new Map<string, number>();
    const bantVeri: BantCizim[] = (spec.bantlar as Bant[]).map((d) => {
      const no = (sayac.get(d.ip) ?? 0) + 1;
      sayac.set(d.ip, no);
      return { ...d, no };
    });
    const bantlar = this.root.select<SVGGElement>('g.rate-bands').selectAll<SVGGElement, BantCizim>('g.rate-bant').data(bantVeri, (d) => `${d.ip}|${d.bas}`);
    bantlar.exit().remove();
    const yeniBant = bantlar.enter().append('g');
    yeniBant.append('rect').attr('fill', MARK[0]).attr('stroke', MARK[0]).attr('stroke-width', 2).attr('rx', 4);
    yeniBant.append('text').attr('class', 'tick rate-bant-etiket');
    const tumBant = yeniBant.merge(bantlar);
    tumBant.attr('class', (d) => `rate-bant ${d.no % 2 === 1 ? 'tek' : 'cift'}`);
    const bantX = (d: BantCizim): number => r1(x(d.bas / 1000));
    const bantW = (d: BantCizim): number => r1(Math.max(0, x(d.son / 1000) - x(d.bas / 1000)));
    tumBant.select('rect')
      .attr('fill-opacity', (d) => (d.no % 2 === 1 ? 0.13 : 0.28)).attr('stroke-opacity', 0.7)
      .attr('x', bantX).attr('width', (d) => Math.max(0, bantW(d) - 1))
      .attr('y', (d) => r1(satirY(d.ip) + ROW_PAD / 2)).attr('height', Math.max(0, r1(satirH - ROW_PAD)));
    // "pencere n" in the band's top-left corner, only where it fits the band and stays clear of the dot stack
    const etiketW2 = this.measure.width('pencere 9', 'tick', tick);
    const yigin = Math.max(1, ...[...this.satirKatlari(spec, x, satirH).values()]);
    const noktaUst = (satirH - Math.min(yigin, Math.max(1, Math.floor((satirH - ROW_PAD * 2 + GAP) / (2 * R + GAP)))) * (2 * R + GAP)) / 2;
    const etiketSigar = (d: BantCizim): boolean => bantW(d) >= etiketW2 + 12 && noktaUst >= tick * 1.35 + ROW_PAD + 2;
    tumBant.select('text')
      .attr('x', (d) => bantX(d) + 6).attr('y', (d) => r1(satirY(d.ip) + ROW_PAD / 2 + tick * 1.05))
      .attr('display', (d) => (etiketSigar(d) ? null : 'none')).text((d) => `pencere ${d.no}`);

    // Dots.
    const yerlesim = this.yerles(spec, x, satirH);
    const noktalar = this.root.select<SVGGElement>('g.rate-dots').selectAll<SVGGElement, Yerlesim>('g.rate-nokta').data(yerlesim, (d) => d.i);
    noktalar.exit().remove();
    const yeni = noktalar.enter().append('g');
    yeni.append('circle').attr('class', 'rate-halka').attr('r', R + 4).attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 2);
    yeni.append('circle').attr('class', 'rate-dot').attr('r', R);
    const hepsi = yeni.merge(noktalar);
    const SINIF = { kabul: 'izin', '429': 'red', '403': 'cors' } as const;
    hepsi.attr('class', (d) => `rate-nokta ${SINIF[d.durum]}`)
      .attr('transform', (d) => `translate(${r1(x(d.t / 1000))},${r1(satirY(d.ip) + satirH / 2 + d.sira * (2 * R + GAP))})`);
    // 403 (CORS, the limiter never saw the call): a hollow dot, so it is not read as a limiter refusal
    hepsi.select('circle.rate-dot')
      .attr('fill', (d) => (d.durum === 'kabul' ? MARK[0] : d.durum === '429' ? MARK[1] : '#fff'))
      .attr('stroke', (d) => (d.durum === '403' ? NAVY : '#fff'))
      .attr('stroke-width', (d) => (d.durum === '403' ? 2.5 : 1.5));
    hepsi.select('circle.rate-halka').attr('display', (d) => (d.etkin ? null : 'none'));
    if (ms > 0) tr(yeni.style('opacity', 0), 'rate', ms).style('opacity', 1);
  }

  /** Dot level (stack position) of every request, and the number of levels per ip row. */
  private katlar(spec: TimelineSpec, x: (s: number) => number, satirH: number): { kat: number[]; sayi: Map<string, number> } {
    const sonX = new Map<string, number[]>();
    const kapasite = Math.max(1, Math.floor((satirH - ROW_PAD * 2 + GAP) / (2 * R + GAP)));
    const kat = spec.noktalar.map((n) => {
      const px = x(n.t / 1000);
      const katlar = sonX.get(n.ip) ?? [];
      let k = katlar.findIndex((s) => px - s >= 2 * R + GAP);
      if (k < 0) k = katlar.length;
      katlar[k] = px;
      sonX.set(n.ip, katlar);
      // a row too short for the stack lets the topmost dots overlap instead of leaving the row
      return Math.min(k, kapasite - 1);
    });
    const sayi = new Map<string, number>();
    spec.noktalar.forEach((n, i) => sayi.set(n.ip, Math.max(sayi.get(n.ip) ?? 0, kat[i] + 1)));
    return { kat, sayi };
  }

  private satirKatlari(spec: TimelineSpec, x: (s: number) => number, satirH: number): Map<string, number> {
    return this.katlar(spec, x, satirH).sayi;
  }

  /** Request order is kept; the stack of a row is centred on the row's centre line, where its ip label sits. */
  private yerles(spec: TimelineSpec, x: (s: number) => number, satirH: number): Yerlesim[] {
    const { kat, sayi } = this.katlar(spec, x, satirH);
    return spec.noktalar.map((n, i) => ({ t: n.t, ip: n.ip, durum: n.durum, etkin: n.etkin, sira: kat[i] - ((sayi.get(n.ip) ?? 1) - 1) / 2, i }));
  }

  destroy(): void {
    this.root.node()?.remove();
  }
}
