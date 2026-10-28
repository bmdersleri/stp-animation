import { scaleLinear, scaleTime } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import { MARK, NAVY, r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { Rect } from '../../core/plot/viewport';
import type { SeriNokta, SeriSpec } from './view';

const NS = 'http://www.w3.org/2000/svg';
/** Dot radius (px). */
const R = 6;
/** Room (px) kept between a dot and the plot edge, so a dot on the edge is not cut by the svg. */
const EDGE = R + 2;
/** The x axis is labelled every 30 minutes; a narrow plot drops to every hour. */
const YARIM_SAAT = 30 * 60_000;
const SAAT = 60 * 60_000;
const GRID = '#E3E9F0';

const sayi = (v: number): string => String(v).replace('-', '−').replace('.', ',');
const saat = (ms: number): string => new Date(ms).toISOString().slice(11, 16);

interface NoktaCizim extends SeriNokta { i: number; x: number; y: number; sabit: boolean; etiket: boolean }

/**
 * The time-series chart of the iot-zaman-serisi page (R5): UTC clock time on x (`HH:MM`), degrees C on y, the fixed series
 * as one line (`path.seri-cizgi`) and a dot (`circle.seri-nokta`, radius 6) per point of the request: accepted `MARK[0]`,
 * rejected `MARK[1]` with the label "kaydedilmedi". A rejected value outside the y range sits on the plot edge and is
 * labelled with its value. `update` re-joins everything with d3, so repeated calls never add elements.
 */
export class SeriLayer {
  private readonly root: Selection<SVGGElement, unknown, null, undefined>;

  constructor(svg: SVGSVGElement, private readonly measure: TextMeasure) {
    const g = svg.ownerDocument.createElementNS(NS, 'g');
    g.setAttribute('class', 'iot-seri-katman');
    svg.append(g);
    this.root = select(g);
    for (const c of ['seri-eksen', 'seri-cizgiler', 'seri-noktalar', 'seri-basliklar']) this.root.append('g').attr('class', c);
  }

  update(spec: SeriSpec, rect: Rect, ms: number): void {
    const tick = this.measure.fontPx('tick', 13);
    const yEtiket = (v: number): string => sayi(Math.round(v * 10) / 10);
    const ustH = Math.ceil(tick * 1.3);
    const altH = Math.ceil(tick * 1.7);
    const ust = rect.top + ustH + EDGE / 2;
    const alt = rect.top + rect.height - altH;
    const yAdet = Math.max(2, Math.floor((alt - ust) / (tick * 1.6)));
    const y0 = scaleLinear().domain([spec.yAlan[0], spec.yAlan[1]]).range([alt - EDGE, ust]);
    // labels keep clear of the unit title above and of each other (thinned from the bottom up)
    const yTicks: number[] = [];
    for (const d of y0.ticks(yAdet)) {
      const yy = y0(d);
      const oncekiY = yTicks.length > 0 ? y0(yTicks[yTicks.length - 1]) : Infinity;
      if (yy - tick * 0.6 >= rect.top + ustH && oncekiY - yy >= tick * 1.3) yTicks.push(d);
    }
    const solW = Math.ceil(this.measure.maxWidth(yTicks.map(yEtiket), 'tick', tick)) + 10;
    const xBaslik = 'saat (UTC)';
    const xBaslikW = Math.ceil(this.measure.width(xBaslik, 'tick', tick));
    const ilkEtiketW = this.measure.width('07:00', 'tick', tick);
    const sol = rect.left + Math.max(solW, xBaslikW + Math.ceil(ilkEtiketW / 2) + 8);
    const sag = rect.left + rect.width - Math.ceil(ilkEtiketW / 2) - 2;
    const x = scaleTime().domain([new Date(spec.xAlan[0]), new Date(spec.xAlan[1])]).range([sol, Math.max(sol + 10, sag)]);
    const px = (t: number): number => x(new Date(t));
    const py = (v: number): number => y0(Math.min(spec.yAlan[1], Math.max(spec.yAlan[0], v)));

    // axes: grid lines and labels, re-joined by value
    const eksen = this.root.select<SVGGElement>('g.seri-eksen');
    const adim = (sag - sol) / ((spec.xAlan[1] - spec.xAlan[0]) / YARIM_SAAT) >= ilkEtiketW * 1.5 ? YARIM_SAAT : SAAT;
    const xTicks: number[] = [];
    for (let t = Math.ceil(spec.xAlan[0] / adim) * adim; t <= spec.xAlan[1]; t += adim) xTicks.push(t);
    const xt = eksen.selectAll<SVGGElement, number>('g.seri-x-tick').data(xTicks, (d) => d);
    xt.exit().remove();
    const xYeni = xt.enter().append('g').attr('class', 'seri-x-tick');
    xYeni.append('line');
    xYeni.append('text').attr('class', 'tick').attr('text-anchor', 'middle');
    const xHepsi = xYeni.merge(xt);
    xHepsi.attr('transform', (d) => `translate(${r1(px(d))},0)`);
    xHepsi.select('line').attr('y1', ust - EDGE / 2).attr('y2', alt).attr('stroke', GRID);
    xHepsi.select('text').attr('y', r1(alt + tick * 1.25)).text((d) => saat(d));
    const yt = eksen.selectAll<SVGGElement, number>('g.seri-y-tick').data(yTicks, (d) => d);
    yt.exit().remove();
    const yYeni = yt.enter().append('g').attr('class', 'seri-y-tick');
    yYeni.append('line');
    yYeni.append('text').attr('class', 'tick').attr('text-anchor', 'end');
    const yHepsi = yYeni.merge(yt);
    yHepsi.attr('transform', (d) => `translate(0,${r1(y0(d))})`);
    yHepsi.select('line').attr('x1', sol).attr('x2', sag + 2).attr('stroke', GRID);
    yHepsi.select('text').attr('x', sol - 6).attr('y', r1(tick * 0.35)).text((d) => yEtiket(d));
    const taban = eksen.selectAll<SVGLineElement, number>('line.seri-taban').data([0]);
    taban.enter().append('line').attr('class', 'seri-taban').merge(taban)
      .attr('x1', sol).attr('x2', sag + 2).attr('y1', alt).attr('y2', alt).attr('stroke', NAVY);
    const yan = eksen.selectAll<SVGLineElement, number>('line.seri-yan').data([0]);
    yan.enter().append('line').attr('class', 'seri-yan').merge(yan)
      .attr('x1', sol).attr('x2', sol).attr('y1', ust - EDGE / 2).attr('y2', alt).attr('stroke', NAVY);

    // axis titles: the unit above the y labels, the time zone at the left end of the x label row
    const basliklar = this.root.select<SVGGElement>('g.seri-basliklar');
    const bas = basliklar.selectAll<SVGTextElement, { ad: string; x: number; y: number; anchor: string }>('text.seri-baslik').data([
      { ad: '°C', x: sol - 6, y: rect.top + tick, anchor: 'end' },
      { ad: xBaslik, x: rect.left, y: alt + tick * 1.25, anchor: 'start' },
    ], (d) => d.ad);
    bas.enter().append('text').attr('class', 'tick seri-baslik').merge(bas)
      .attr('text-anchor', (d) => d.anchor).attr('x', (d) => r1(d.x)).attr('y', (d) => r1(d.y)).text((d) => d.ad);

    // the series: one line
    const veri = spec.seri.map((o) => `${r1(px(o.zaman))},${r1(py(o.deger))}`);
    const cizgi = this.root.select<SVGGElement>('g.seri-cizgiler').selectAll<SVGPathElement, string>('path.seri-cizgi').data(veri.length > 0 ? [`M${veri.join('L')}`] : []);
    cizgi.exit().remove();
    cizgi.enter().append('path').attr('class', 'seri-cizgi').attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 2.5).attr('stroke-linejoin', 'round')
      .merge(cizgi).attr('d', (d) => d);

    // the request's points, keyed by order; the first rejected one carries the label
    const ilkRed = spec.noktalar.findIndex((n) => n.durum === 'red');
    const noktalar: NoktaCizim[] = spec.noktalar.map((n, i) => ({
      ...n, i, x: px(n.zaman), y: py(n.deger),
      sabit: n.deger < spec.yAlan[0] || n.deger > spec.yAlan[1],
      etiket: i === ilkRed,
    }));
    const nokta = this.root.select<SVGGElement>('g.seri-noktalar').selectAll<SVGGElement, NoktaCizim>('g.seri-nokta-grup').data(noktalar, (d) => d.i);
    nokta.exit().remove();
    const yeni = nokta.enter().append('g').attr('class', 'seri-nokta-grup');
    yeni.append('circle').attr('class', 'seri-nokta').attr('r', R).attr('stroke', '#fff').attr('stroke-width', 1.5);
    yeni.append('text').attr('class', 'tick seri-etiket').attr('text-anchor', 'end');
    const hepsi = yeni.merge(nokta);
    hepsi.attr('data-durum', (d) => d.durum);
    hepsi.select('circle').attr('cx', (d) => r1(d.x)).attr('cy', (d) => r1(d.y)).attr('fill', (d) => (d.durum === 'kabul' ? MARK[0] : MARK[1]));
    const etiket = hepsi.select<SVGTextElement>('text.seri-etiket');
    etiket.attr('display', (d) => (d.etiket ? null : 'none')).attr('x', (d) => r1(d.x - R - 6)).attr('y', (d) => r1(d.y + tick * 0.35));
    etiket.selectAll('tspan').remove();
    etiket.each(function (d) {
      if (!d.etiket) return;
      const t = select(this);
      if (d.sabit) t.append('tspan').attr('class', 'seri-deger').text(`${sayi(d.deger)} °C · `);
      t.append('tspan').attr('class', 'seri-kayitsiz').text('kaydedilmedi');
    });
    if (ms > 0) tr(yeni.style('opacity', 0), 'seri', ms).style('opacity', 1);
  }

  destroy(): void {
    this.root.node()?.remove();
  }
}
