// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import '../svg-stubs';
import { SeriLayer } from '../../../src/concepts/iot-zaman-serisi/scene-seri';
import { SABIT_SERI } from '../../../src/concepts/iot-zaman-serisi/telemetri';
import type { SeriSpec } from '../../../src/concepts/iot-zaman-serisi/view';
import { TextMeasure } from '../../../src/core/plot/text-measure';

const NS = 'http://www.w3.org/2000/svg';
const X_ALAN = [Date.UTC(2026, 8, 5, 7), Date.UTC(2026, 8, 5, 10, 10)] as const;
const T10 = Date.UTC(2026, 8, 5, 10);

function kur() {
  const svg = document.createElementNS(NS, 'svg');
  const probe = document.createElementNS(NS, 'text');
  svg.append(probe);
  document.body.append(svg);
  return { svg, layer: new SeriLayer(svg, new TextMeasure(probe as SVGTextElement)) };
}
const spec = (noktalar: SeriSpec['noktalar'], yAlan: [number, number] = [19, 24.2]): SeriSpec => ({ seri: SABIT_SERI, noktalar, xAlan: X_ALAN, yAlan });
const RECT = { left: 0, top: 0, width: 800, height: 160 };

describe('SeriLayer', () => {
  it('draws one path and one dot per point', () => {
    const { svg, layer } = kur();
    layer.update(spec([{ zaman: T10, deger: 21.5, durum: 'kabul' }, { zaman: T10 + 20_000, deger: 21.5, durum: 'kabul' }]), RECT, 0);
    expect(svg.querySelectorAll('path.seri-cizgi')).toHaveLength(1);
    expect(svg.querySelector('path.seri-cizgi')!.getAttribute('d')!.split('L')).toHaveLength(SABIT_SERI.length);
    const dots = svg.querySelectorAll('circle.seri-nokta');
    expect(dots).toHaveLength(2);
    expect(dots[0].getAttribute('r')).toBe('6');
    expect(dots[0].getAttribute('fill')).toBe('#0EA5A4');
    expect(svg.textContent).toContain('saat (UTC)');
    expect(svg.textContent).toContain('°C');
    expect([...svg.querySelectorAll('.seri-x-tick text')].map((t) => t.textContent)).toContain('10:00');
  });

  it('red point outside the range sits on the edge with its value', () => {
    const { svg, layer } = kur();
    layer.update(spec([{ zaman: T10, deger: -999, durum: 'red' }]), RECT, 0);
    const dot = svg.querySelector('circle.seri-nokta')!;
    expect(dot.getAttribute('fill')).toBe('#F08A00');
    const taban = Number(svg.querySelector('line.seri-taban')!.getAttribute('y1'));
    expect(Number(dot.getAttribute('cy'))).toBeGreaterThan(taban - 10);
    expect(Number(dot.getAttribute('cy'))).toBeLessThanOrEqual(taban);
    expect(svg.querySelector('.seri-deger')!.textContent).toContain('−999 °C');
    expect(svg.querySelector('.seri-kayitsiz')!.textContent).toBe('kaydedilmedi');
  });

  it('a red point inside the range keeps its place and is not labelled with a value', () => {
    const { svg, layer } = kur();
    layer.update(spec([{ zaman: T10, deger: 21.5, durum: 'red' }]), RECT, 0);
    expect(svg.querySelector('.seri-deger')).toBeNull();
    expect(svg.querySelector('.seri-kayitsiz')!.textContent).toBe('kaydedilmedi');
  });

  it('resize twice keeps one axis', () => {
    const { svg, layer } = kur();
    layer.update(spec([]), RECT, 0);
    const ticks = svg.querySelectorAll('.seri-x-tick').length;
    layer.update(spec([]), { ...RECT, width: 500, height: 120 }, 0);
    layer.update(spec([]), RECT, 0);
    expect(svg.querySelectorAll('line.seri-taban')).toHaveLength(1);
    expect(svg.querySelectorAll('line.seri-yan')).toHaveLength(1);
    expect(svg.querySelectorAll('.seri-baslik')).toHaveLength(2);
    expect(svg.querySelectorAll('.seri-x-tick')).toHaveLength(ticks);
    expect(svg.querySelectorAll('path.seri-cizgi')).toHaveLength(1);
  });

  it('two points 20 s apart are drawn visibly apart', () => {
    const { svg, layer } = kur();
    layer.update(spec([{ zaman: T10, deger: 21.5, durum: 'kabul' }, { zaman: T10 + 20_000, deger: 21.5, durum: 'kabul' }]), RECT, 0);
    const cx = [...svg.querySelectorAll('circle.seri-nokta')].map((c) => Number(c.getAttribute('cx')));
    expect(Math.abs(cx[1] - cx[0])).toBeGreaterThanOrEqual(8);
    expect([...svg.querySelectorAll('.seri-x-tick text')].map((t) => t.textContent)).toContain('10:00');
  });

  it('a lone point keeps the full axis from 07:00 to 10:00', () => {
    const { svg, layer } = kur();
    layer.update(spec([{ zaman: T10, deger: 21.5, durum: 'kabul' }]), RECT, 0);
    const t = [...svg.querySelectorAll('.seri-x-tick text')].map((x) => x.textContent);
    expect(t[0]).toBe('07:00');
    expect(t[t.length - 1]).toBe('10:00');
  });

  it('always has at least two y labels, also in a short chart', () => {
    const { svg, layer } = kur();
    layer.update(spec([]), { ...RECT, height: 100 }, 0);
    expect(svg.querySelectorAll('.seri-y-tick').length).toBeGreaterThanOrEqual(2);
    layer.update(spec([{ zaman: T10, deger: -999, durum: 'red' }], [-1000, 24]), { ...RECT, height: 100 }, 0);
    expect(svg.querySelectorAll('.seri-y-tick').length).toBeGreaterThanOrEqual(2);
  });

  it('a changed point replaces the old one', () => {
    const { svg, layer } = kur();
    layer.update(spec([{ zaman: T10, deger: 21.5, durum: 'kabul' }]), RECT, 0);
    layer.update(spec([{ zaman: T10, deger: 22, durum: 'red' }]), RECT, 0);
    expect(svg.querySelectorAll('circle.seri-nokta')).toHaveLength(1);
    expect(svg.querySelector('circle.seri-nokta')!.getAttribute('fill')).toBe('#F08A00');
  });
});
