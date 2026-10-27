// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CodeTrace } from '../../../src/core/plot/code-trace';

const lines = Array.from({ length: 10 }, (_, i) => `satir ${i + 1}`);
const make = (): { host: HTMLElement; ct: CodeTrace } => {
  const host = document.createElement('div');
  document.body.append(host);
  return { host, ct: new CodeTrace(host) };
};
const nums = (host: Element): number[] => [...host.querySelectorAll('ol.code-trace-lines > li')].map((li) => Number(li.getAttribute('data-line')));

describe('CodeTrace', () => {
  it('renders numbered lines', () => {
    const { host, ct } = make();
    ct.update({ title: 'sunucu.py', lines, active: [] });
    expect(host.querySelector('.code-trace-title')!.textContent).toBe('sunucu.py');
    expect(nums(host)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(host.querySelector('li[data-line="3"]')!.textContent).toContain('satir 3');
  });

  it('marks active lines', () => {
    const { host, ct } = make();
    ct.update({ title: 't', lines, active: [2, 4] });
    expect([...host.querySelectorAll('li.active')].map((l) => l.getAttribute('data-line'))).toEqual(['2', '4']);
  });

  it('note text appears in its line', () => {
    const { host, ct } = make();
    ct.update({ title: 't', lines, active: [2], notes: { 2: 'kural kontrolü' } });
    expect(host.querySelector('li[data-line="2"] span.code-trace-note')!.textContent).toBe('kural kontrolü');
    expect(host.querySelectorAll('span.code-trace-note')).toHaveLength(1);
  });

  it('window limits rendered lines', () => {
    const { host, ct } = make();
    ct.update({ title: 't', lines, active: [5], window: 2 });
    expect(nums(host)).toEqual([3, 4, 5, 6, 7]);
  });

  it('update replaces, does not append', () => {
    const { host, ct } = make();
    ct.update({ title: 'a', lines, active: [1] });
    ct.update({ title: 'b', lines: lines.slice(0, 3), active: [] });
    expect(nums(host)).toEqual([1, 2, 3]);
    expect(host.querySelectorAll('.code-trace')).toHaveLength(1);
    expect(host.querySelector('.code-trace-title')!.textContent).toBe('b');
  });

  it('destroy removes root', () => {
    const { host, ct } = make();
    ct.destroy();
    expect(host.querySelector('.code-trace')).toBeNull();
  });
});
