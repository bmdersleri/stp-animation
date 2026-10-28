// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import '../svg-stubs';
import { ZamanLayer } from '../../../src/concepts/timeout-retry/scene-zaman';
import type { ZamanSpec } from '../../../src/concepts/timeout-retry/view';
import { TextMeasure } from '../../../src/core/plot/text-measure';

const NS = 'http://www.w3.org/2000/svg';
const RECT = { left: 0, top: 0, width: 800, height: 160 };

function kur() {
  const svg = document.createElementNS(NS, 'svg');
  const probe = document.createElementNS(NS, 'text');
  svg.append(probe);
  document.body.append(svg);
  return { svg, layer: new ZamanLayer(svg, new TextMeasure(probe as SVGTextElement)) };
}

const RETRY: ZamanSpec = {
  cubuklar: [{ deneme: 1, bas: 0, son: 5000, uc: 'iptal' }, { deneme: 2, bas: 6000, son: 7200, uc: 'yanit' }],
  bosluklar: [{ bas: 5000, son: 6000, etiket: 'bekle 1000 ms' }],
  zamanAsimiMs: 5000, eksenMs: 10_000, toplamEtiket: 'toplam 7200 ms',
};

describe('ZamanLayer', () => {
  it('one bar per attempt and one gap per wait', () => {
    const { svg, layer } = kur();
    layer.update(RETRY, RECT, 0);
    expect(svg.querySelectorAll('rect.deneme-cubuk')).toHaveLength(2);
    expect(svg.querySelectorAll('g.bekle')).toHaveLength(1);
    expect(svg.querySelector('g.bekle text')!.textContent).toBe('bekle 1000 ms');
    expect([...svg.querySelectorAll('.zaman-satir-ad')].map((t) => t.textContent)).toEqual(['Deneme 1', 'Deneme 2']);
    const tips = [...svg.querySelectorAll('circle.zaman-uc')].map((c) => c.getAttribute('fill'));
    expect(tips).toEqual(['#F08A00', '#0EA5A4']);
    expect(svg.querySelectorAll('line.zaman-asimi')).toHaveLength(1);
    expect(svg.querySelector('.zaman-asimi-etiket')!.textContent).toBe('zaman aşımı 5000 ms');
    expect(svg.querySelector('text.toplam')!.textContent).toBe('toplam 7200 ms');
    expect([...svg.querySelectorAll('.zaman-tick text')].map((t) => t.textContent)).toContain('5 s');
  });

  it('cut bar ends with an ellipsis at the axis edge', () => {
    const { svg, layer } = kur();
    layer.update({
      cubuklar: [{ deneme: 1, bas: 0, son: 10_000, uc: 'iptal' }, { deneme: 2, bas: 12_000, son: 22_000, uc: 'iptal' }, { deneme: 3, bas: 26_000, son: 30_000, uc: 'kesik' }],
      bosluklar: [{ bas: 10_000, son: 12_000, etiket: 'bekle 2000 ms' }, { bas: 22_000, son: 26_000, etiket: 'bekle 4000 ms' }],
      zamanAsimiMs: 10_000, eksenMs: 30_000, toplamEtiket: 'toplam 54000 ms',
    }, RECT, 0);
    const kesik = svg.querySelector('g.zaman-satir[data-uc="kesik"]')!;
    const bar = kesik.querySelector('rect.deneme-cubuk')!;
    const elips = kesik.querySelector('text.zaman-elips')!;
    expect(elips.getAttribute('display')).toBeNull();
    expect(kesik.querySelector('circle.zaman-uc')!.getAttribute('display')).toBe('none');
    const kenar = Number(bar.getAttribute('x')) + Number(bar.getAttribute('width'));
    expect(Number(elips.getAttribute('x'))).toBeGreaterThanOrEqual(kenar);
    expect(Number(elips.getAttribute('x'))).toBeLessThan(RECT.width);
    expect(svg.querySelector('text.toplam')!.textContent).toBe('toplam 54000 ms');
  });

  it('an endless bar has no timeout line and no total', () => {
    const { svg, layer } = kur();
    layer.update({ cubuklar: [{ deneme: 1, bas: 0, son: 10_000, uc: 'sonsuz' }], bosluklar: [], zamanAsimiMs: null, eksenMs: 10_000, toplamEtiket: null }, RECT, 0);
    expect(svg.querySelectorAll('line.zaman-asimi')).toHaveLength(0);
    expect(svg.querySelectorAll('text.toplam')).toHaveLength(0);
    expect(svg.querySelector('g.zaman-satir[data-uc="sonsuz"] text.zaman-elips')!.getAttribute('display')).toBeNull();
  });

  it('resize twice keeps one axis', () => {
    const { svg, layer } = kur();
    layer.update(RETRY, RECT, 0);
    const ticks = svg.querySelectorAll('.zaman-tick').length;
    layer.update(RETRY, { ...RECT, width: 400 }, 0);
    layer.update(RETRY, RECT, 0);
    expect(svg.querySelectorAll('line.zaman-taban')).toHaveLength(1);
    expect(svg.querySelectorAll('.zaman-tick')).toHaveLength(ticks);
    expect(svg.querySelectorAll('rect.deneme-cubuk')).toHaveLength(2);
    expect(svg.querySelectorAll('g.bekle')).toHaveLength(1);
    expect(svg.querySelectorAll('text.toplam')).toHaveLength(1);
  });

  it('height grows with the attempt rows and the header lines', () => {
    const { layer } = kur();
    const bir = { ...RETRY, cubuklar: [RETRY.cubuklar[0]], bosluklar: [] };
    expect(layer.height(RETRY, 800)).toBeGreaterThan(layer.height(bir, 800));
    expect(layer.height(RETRY, 200)).toBeGreaterThan(layer.height(RETRY, 800));
  });
});
