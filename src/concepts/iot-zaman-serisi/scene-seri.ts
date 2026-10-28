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
const DAKIKA = 60_000;
const SAAT = 60 * DAKIKA;
/** Label spacings tried from the finest: a zoomed axis gets minutes, the full axis half hours or hours. */
const ADIMLAR = [5 * DAKIKA, 10 * DAKIKA, 30 * DAKIKA, SAAT];
/** Two points closer than this many px zoom the x axis; the zoom keeps this many ms around them. */
const MIN_AYRIM = 12;
const YAKIN_PAY = 10 * DAKIKA;
const GRID = '#E3E9F0';

const sayi = (v: number): string => String(v).replace('-', '−').replace('.', ',');
const saat = (ms: number): string => new Date(ms).toISOString().slice(11, 16);

let klipSayac = 0;

interface NoktaCizim extends SeriNokta { i: number; x: number; y: number; sabit: boolean; etiket: boolean }

/**
 * The time-series chart of the iot-zaman-serisi page (R5): UTC clock time on x (`HH:MM`), degrees C on y, the fixed series
 * as one line (`path.seri-cizgi`) and a dot (`circle.seri-nokta`, radius 6) per point of the request: accepted `MARK[0]`,
 * rejected `MARK[1]` with the label "kaydedilmedi". A rejected value outside the y range sits on the plot edge and is
 * labelled with its value. `update` re-joins everything with d3, so repeated calls never add elements.
 */
export class SeriLayer {
  private readonly clipId: string;
  private readonly root: Selection<SVGGElement, unknown, null, undefined>;

  constructor(svg: SVGSVGElement, private readonly measure: TextMeasure) {
    const g = svg.ownerDocument.createElementNS(NS, 'g');
    g.setAttribute('class', 'iot-seri-katman');
    svg.append(g);
    this.root = select(g);
    this.clipId = `seri-klip-${klipSayac++}`;
    this.root.append('clipPath').attr('id', this.clipId).append('rect');
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
    // labels keep clear of each other (thinned from the bottom up); there are always at least two
    const yTicks: number[] = [];
    for (const d of y0.ticks(yAdet)) {
      const oncekiY = yTicks.length > 0 ? y0(yTicks[yTicks.length - 1]) : Infinity;
      if (oncekiY - y0(d) >= tick * 1.3) yTicks.push(d);
    }
    if (yTicks.length < 2) yTicks.splice(0, yTicks.length, spec.yAlan[0], spec.yAlan[1]);
    const solW = Math.ceil(this.measure.maxWidth(yTicks.map(yEtiket), 'tick', tick)) + 10;
    const xBaslik = 'saat (UTC)';
    const xBaslikW = Math.ceil(this.measure.width(xBaslik, 'tick', tick));
    const ilkEtiketW = this.measure.width('07:00', 'tick', tick);
    const sol = rect.left + Math.max(solW, xBaslikW + Math.ceil(ilkEtiketW / 2) + 8);
    const sag = rect.left + rect.width - Math.ceil(ilkEtiketW / 2) - 2;
    // points that would sit under one dot at the full axis (two requests 20 s apart) zoom the axis in around them
    const zamanlar = spec.noktalar.map((n) => n.zaman);
    const aralik = zamanlar.length > 1 ? Math.max(...zamanlar) - Math.min(...zamanlar) : 0;
    const genislik = Math.max(10, sag - sol);
    const yakin = aralik > 0 && (aralik / (spec.xAlan[1] - spec.xAlan[0])) * genislik < MIN_AYRIM;
    const alan: readonly [number, number] = yakin ? [Math.max(spec.xAlan[0], Math.min(...zamanlar) - YAKIN_PAY), Math.min(spec.xAlan[1], Math.max(...zamanlar) + YAKIN_PAY)] : spec.xAlan;
    const x = scaleTime().domain([new Date(alan[0]), new Date(alan[1])]).range([sol, sol + genislik]);
    const px = (t: number): number => x(new Date(t));
    const py = (v: number): number => y0(Math.min(spec.yAlan[1], Math.max(spec.yAlan[0], v)));

    // axes: grid lines and labels, re-joined by value
    const eksen = this.root.select<SVGGElement>('g.seri-eksen');
    const adim = ADIMLAR.find((a) => (genislik / ((alan[1] - alan[0]) / a)) >= ilkEtiketW * 1.5) ?? SAAT;
    const xTicks: number[] = [];
    for (let t = Math.ceil(alan[0] / adim) * adim; t <= alan[1]; t += adim) xTicks.push(t);
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
      { ad: '°C', x: rect.left, y: rect.top + tick, anchor: 'start' },
      { ad: xBaslik, x: rect.left, y: alt + tick * 1.25, anchor: 'start' },
    ], (d) => d.ad);
    bas.enter().append('text').attr('class', 'tick seri-baslik').merge(bas)
      .attr('text-anchor', (d) => d.anchor).attr('x', (d) => r1(d.x)).attr('y', (d) => r1(d.y)).text((d) => d.ad);

    // the series: one line, clipped to the plot (a zoomed axis cuts it at the edges)
    this.root.select('clipPath rect').attr('x', sol).attr('y', ust - EDGE / 2).attr('width', Math.max(0, sag - sol + 2)).attr('height', Math.max(0, alt - ust + EDGE / 2));
    this.root.select('g.seri-cizgiler').attr('clip-path', `url(#${this.clipId})`);
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
    // one line "value · kaydedilmedi" left of the dot; where that would reach the y labels, two lines
    const bosluk = (d: NoktaCizim): number => d.x - R - 6 - sol - 4;
    const tek = (d: NoktaCizim): boolean => this.measure.width(`${sayi(d.deger)} °C · kaydedilmedi`, 'tick', tick) <= bosluk(d);
    etiket.attr('display', (d) => (d.etiket ? null : 'none')).attr('x', (d) => r1(d.x - R - 6)).attr('y', (d) => r1(d.y + tick * 0.35));
    etiket.selectAll('tspan').remove();
    etiket.each(function (d) {
      if (!d.etiket) return;
      const t = select(this);
      const x = r1(d.x - R - 6);
      if (d.sabit && tek(d)) {
        t.append('tspan').attr('class', 'seri-deger').text(`${sayi(d.deger)} °C · `);
        t.append('tspan').attr('class', 'seri-kayitsiz').text('kaydedilmedi');
      } else if (d.sabit) {
        t.append('tspan').attr('class', 'seri-deger').attr('x', x).attr('dy', r1(d.y > (ust + alt) / 2 ? -tick * 1.5 : 0)).text(`${sayi(d.deger)} °C`);
        t.append('tspan').attr('class', 'seri-kayitsiz').attr('x', x).attr('dy', r1(tick * 1.1)).text('kaydedilmedi');
      } else {
        t.append('tspan').attr('class', 'seri-kayitsiz').text('kaydedilmedi');
      }
    });
    if (ms > 0) tr(yeni.style('opacity', 0), 'seri', ms).style('opacity', 1);
  }

  destroy(): void {
    this.root.node()?.remove();
  }
}
