import { scaleLinear } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import { ACCENT, GRID, MARK, NAVY, r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { Rect } from '../../core/plot/viewport';
import type { Bosluk, Cubuk, ZamanSpec } from './view';

const NS = 'http://www.w3.org/2000/svg';
/** Radius (px) of the tip mark at the end of a bar. */
const R = 6;
/** Tick spacings (ms) tried from the finest. */
/** Class of the header labels; the CSS makes it bold, so it is also the class their width is measured with. */
const BASLIK_SINIFI = 'tick zaman-baslik';
const ADIMLAR = [1000, 2000, 2500, 5000, 10_000];

const sayi = (v: number): string => String(v).replace('.', ',');
const saniye = (ms: number): string => `${sayi(ms / 1000)} s`;

interface Yerlesim {
  baslikSatir: number;
  satirlar: number;
  tick: number;
  satirH: number;
  ustH: number;
  altH: number;
}

/**
 * The time axis of the timeout-retry page (R5, d3 SVG): virtual ms on x (`0 s`, `5 s`, ...), one row per attempt
 * (`Deneme 1`, `Deneme 2`). A bar (`rect.deneme-cubuk`) runs from the request to its end; the tip is a mark: `iptal`
 * MARK[1] (alarm), `yanit` MARK[0] (teal), `kesik` and `sonsuz` an ellipsis at the axis edge. A wait is a dashed line
 * with its label (`g.bekle`) on the row of the attempt before it. `zamanAsimiMs` is a vertical line
 * (`line.zaman-asimi`) with its label; the real total (`text.toplam`) sits at the right of the header. `update`
 * re-joins everything, so repeated calls never add elements.
 */
export class ZamanLayer {
  private readonly root: Selection<SVGGElement, unknown, null, undefined>;

  constructor(svg: SVGSVGElement, private readonly measure: TextMeasure) {
    const g = svg.ownerDocument.createElementNS(NS, 'g');
    g.setAttribute('class', 'zaman-katman');
    svg.append(g);
    this.root = select(g);
    for (const c of ['zaman-eksen', 'zaman-satirlar', 'zaman-bosluklar', 'zaman-cizgi', 'zaman-etiketler']) this.root.append('g').attr('class', c);
  }

  private etiketler(spec: ZamanSpec): { asim: string | null; toplam: string | null } {
    return { asim: spec.zamanAsimiMs === null ? null : `zaman aşımı ${spec.zamanAsimiMs} ms`, toplam: spec.toplamEtiket };
  }

  /** Plot box (x from `sol` to `sag`, relative to the layer's left edge) for `width` px. */
  private kutu(spec: ZamanSpec, width: number, tick: number, satirlar: number): { sol: number; sag: number } {
    const solW = Math.ceil(this.measure.maxWidth(Array.from({ length: satirlar }, (_, i) => `Deneme ${i + 1}`), 'tick', tick)) + 8;
    const uzunTick = Math.max(this.measure.width(saniye(spec.eksenMs), 'tick', tick), this.measure.width('0 s', 'tick', tick));
    const elipsW = this.measure.width('…', 'tick', tick);
    return { sol: solW, sag: width - Math.max(Math.ceil(uzunTick / 2) + 2, Math.ceil(elipsW) + R + 4) };
  }

  /** Where the timeout label goes: right of its line, or left of it where the right edge is too near. */
  private asimYeri(spec: ZamanSpec, kutu: { sol: number; sag: number }, width: number, tick: number): { x: number; anchor: 'start' | 'end'; w: number } | null {
    const { asim } = this.etiketler(spec);
    if (!asim || spec.zamanAsimiMs === null) return null;
    const w = this.measure.width(asim, BASLIK_SINIFI, tick);
    const lx = kutu.sol + ((kutu.sag - kutu.sol) * spec.zamanAsimiMs) / spec.eksenMs;
    return lx + 4 + w <= width ? { x: lx + 4, anchor: 'start', w } : { x: Math.max(w, lx - 4), anchor: 'end', w };
  }

  /** Header lines the two labels need at `width` px: one, or two when they would meet. */
  private baslikSatiri(spec: ZamanSpec, width: number, tick: number, satirlar: number): number {
    const { toplam } = this.etiketler(spec);
    const asim = this.asimYeri(spec, this.kutu(spec, width, tick, satirlar), width, tick);
    if (!asim || !toplam) return asim || toplam ? 1 : 0;
    const asimSag = asim.anchor === 'start' ? asim.x + asim.w : asim.x;
    return asimSag + 12 <= width - this.measure.width(toplam, BASLIK_SINIFI, tick) ? 1 : 2;
  }

  private yerlesim(spec: ZamanSpec, width: number): Yerlesim {
    const tick = this.measure.fontPx('tick', 13);
    const satirlar = Math.max(1, ...spec.cubuklar.map((c) => c.deneme));
    const baslikSatir = this.baslikSatiri(spec, width, tick, satirlar);
    return { baslikSatir, satirlar, tick, satirH: Math.ceil(tick * 1.5), ustH: baslikSatir === 0 ? 4 : Math.ceil(tick * 1.35 * baslikSatir) + 2, altH: Math.ceil(tick * 1.8) };
  }

  /** The height (px) the layer needs at `width` px. */
  height(spec: ZamanSpec, width: number): number {
    const y = this.yerlesim(spec, width);
    return y.ustH + y.satirlar * y.satirH + y.altH;
  }

  update(spec: ZamanSpec, rect: Rect, ms: number): void {
    const y = this.yerlesim(spec, rect.width);
    const { tick } = y;
    const kutu = this.kutu(spec, rect.width, tick, y.satirlar);
    const sol = rect.left + kutu.sol;
    const sag = rect.left + kutu.sag;
    const genislik = Math.max(10, sag - sol);
    const x = scaleLinear().domain([0, spec.eksenMs]).range([sol, sol + genislik]);
    const px = (t: number): number => r1(x(t));
    const ust = rect.top + y.ustH;
    const alt = ust + y.satirlar * y.satirH;
    const uzunTick = Math.max(this.measure.width(saniye(spec.eksenMs), 'tick', tick), this.measure.width('0 s', 'tick', tick));
    const adim = ADIMLAR.find((a) => genislik / (spec.eksenMs / a) >= uzunTick * 1.5) ?? ADIMLAR[ADIMLAR.length - 1];
    const ticks: number[] = [];
    for (let t = 0; t <= spec.eksenMs; t += adim) ticks.push(t);

    const eksen = this.root.select<SVGGElement>('g.zaman-eksen');
    const xt = eksen.selectAll<SVGGElement, number>('g.zaman-tick').data(ticks, (d) => d);
    xt.exit().remove();
    const yeniTick = xt.enter().append('g').attr('class', 'zaman-tick');
    yeniTick.append('line');
    yeniTick.append('text').attr('class', 'tick').attr('text-anchor', 'middle');
    const tickHepsi = yeniTick.merge(xt);
    tickHepsi.attr('transform', (d) => `translate(${px(d)},0)`);
    tickHepsi.select('line').attr('y1', ust).attr('y2', alt).attr('stroke', GRID);
    tickHepsi.select('text').attr('y', r1(alt + tick * 1.25)).text((d) => saniye(d));
    const taban = eksen.selectAll<SVGLineElement, number>('line.zaman-taban').data([0]);
    taban.enter().append('line').attr('class', 'zaman-taban').merge(taban).attr('x1', sol).attr('x2', sag).attr('y1', alt).attr('y2', alt).attr('stroke', NAVY);

    // rows: the label, the bar and its tip
    const satirData = spec.cubuklar.map((c) => ({ ...c, cy: ust + (c.deneme - 0.5) * y.satirH }));
    const satirKok = this.root.select<SVGGElement>('g.zaman-satirlar');
    const bar = satirKok.selectAll<SVGGElement, Cubuk & { cy: number }>('g.zaman-satir').data(satirData, (d) => d.deneme);
    bar.exit().remove();
    const yeni = bar.enter().append('g').attr('class', 'zaman-satir');
    yeni.append('text').attr('class', 'tick zaman-satir-ad').attr('text-anchor', 'start');
    yeni.append('rect').attr('class', 'deneme-cubuk').attr('rx', 3).attr('fill', NAVY);
    yeni.append('circle').attr('class', 'zaman-uc').attr('r', R).attr('stroke', '#fff').attr('stroke-width', 1.5);
    yeni.append('text').attr('class', 'tick zaman-elips').attr('text-anchor', 'start').text('…');
    const hepsi = yeni.merge(bar);
    hepsi.attr('data-uc', (d) => d.uc);
    hepsi.select('text.zaman-satir-ad').attr('x', rect.left).attr('y', (d) => r1(d.cy + tick * 0.35)).text((d) => `Deneme ${d.deneme}`);
    const barH = Math.round(y.satirH * 0.42);
    hepsi.select('rect.deneme-cubuk')
      .attr('x', (d) => px(d.bas)).attr('y', (d) => r1(d.cy - barH / 2)).attr('height', barH)
      .attr('width', (d) => Math.max(1, px(d.son) - px(d.bas)));
    const isaretli = (d: Cubuk): boolean => d.uc === 'iptal' || d.uc === 'yanit';
    hepsi.select('circle.zaman-uc')
      .attr('display', (d) => (isaretli(d) ? null : 'none'))
      .attr('cx', (d) => px(d.son)).attr('cy', (d) => r1(d.cy))
      .attr('fill', (d) => (d.uc === 'iptal' ? MARK[1] : MARK[0]));
    hepsi.select('text.zaman-elips')
      .attr('display', (d) => (isaretli(d) ? 'none' : null))
      .attr('x', (d) => px(d.son) + 3).attr('y', (d) => r1(d.cy + tick * 0.35));

    // waits: dashed line and label on the row of the attempt before
    const bosData = spec.bosluklar.map((b, i) => ({ ...b, i, cy: ust + (i + 0.5) * y.satirH }));
    const bosKok = this.root.select<SVGGElement>('g.zaman-bosluklar');
    const bos = bosKok.selectAll<SVGGElement, Bosluk & { i: number; cy: number }>('g.bekle').data(bosData, (d) => d.i);
    bos.exit().remove();
    const bosYeni = bos.enter().append('g').attr('class', 'bekle');
    bosYeni.append('line').attr('stroke', NAVY).attr('stroke-width', 2).attr('stroke-dasharray', '5 4');
    bosYeni.append('text').attr('class', 'tick bekle-etiket').attr('text-anchor', 'start');
    const bosHepsi = bosYeni.merge(bos);
    const bosBas = (d: { bas: number }): number => px(d.bas) + R + 3;
    bosHepsi.select('line').attr('x1', bosBas).attr('x2', (d) => Math.max(bosBas(d), px(d.son))).attr('y1', (d) => r1(d.cy)).attr('y2', (d) => r1(d.cy));
    // the label goes right of the wait on its row; where the edge is too near, left of the next bar on the row below
    const bosGenislik = (d: Bosluk): number => this.measure.width(d.etiket, 'tick', tick);
    const etiketYeri = (d: Bosluk & { cy: number }): { x: number; y: number; anchor: string } => {
      const bitis = Math.max(bosBas(d), px(d.son));
      const w = bosGenislik(d);
      if (bitis + 6 + w <= rect.left + rect.width) return { x: bitis + 6, y: d.cy, anchor: 'start' };
      if (px(d.son) - 6 - w >= sol) return { x: px(d.son) - 6, y: d.cy + y.satirH, anchor: 'end' };
      return { x: rect.left + rect.width, y: d.cy, anchor: 'end' };
    };
    bosHepsi.select('text').attr('text-anchor', (d) => etiketYeri(d).anchor)
      .attr('x', (d) => r1(etiketYeri(d).x)).attr('y', (d) => r1(etiketYeri(d).y + tick * 0.35)).text((d) => d.etiket);

    // timeout line
    const asimData = spec.zamanAsimiMs === null ? [] : [spec.zamanAsimiMs];
    const asim = this.root.select<SVGGElement>('g.zaman-cizgi').selectAll<SVGLineElement, number>('line.zaman-asimi').data(asimData);
    asim.exit().remove();
    asim.enter().append('line').attr('class', 'zaman-asimi').attr('stroke', ACCENT).attr('stroke-width', 2.5).merge(asim)
      .attr('x1', (d) => px(d)).attr('x2', (d) => px(d)).attr('y1', ust - 2).attr('y2', alt);

    // header labels: the timeout label beside its line, the total at the right edge
    const { asim: asimEtiket, toplam } = this.etiketler(spec);
    const baslik: { sinif: string; metin: string; x: number; y: number; anchor: string }[] = [];
    const satir1 = rect.top + tick * 1.05;
    const satir2 = rect.top + tick * 1.05 + tick * 1.35;
    const asimYeri = this.asimYeri(spec, kutu, rect.width, tick);
    if (asimEtiket && asimYeri) baslik.push({ sinif: 'zaman-asimi-etiket', metin: asimEtiket, x: rect.left + asimYeri.x, y: satir1, anchor: asimYeri.anchor });
    if (toplam) baslik.push({ sinif: 'toplam', metin: toplam, x: rect.left + rect.width, y: y.baslikSatir === 2 ? satir2 : satir1, anchor: 'end' });
    const et = this.root.select<SVGGElement>('g.zaman-etiketler').selectAll<SVGTextElement, (typeof baslik)[number]>('text.zaman-baslik').data(baslik, (d) => d.sinif);
    et.exit().remove();
    et.enter().append('text').merge(et)
      .attr('class', (d) => `tick zaman-baslik ${d.sinif}`).attr('text-anchor', (d) => d.anchor)
      .attr('x', (d) => r1(d.x)).attr('y', (d) => r1(d.y)).text((d) => d.metin);

    if (ms > 0) tr(yeni.style('opacity', 0), 'zaman', ms).style('opacity', 1);
  }

  destroy(): void {
    this.root.node()?.remove();
  }
}
