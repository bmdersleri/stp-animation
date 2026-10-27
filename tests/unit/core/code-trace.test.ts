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

  it('update scrolls only its own list: no scrollIntoView, no ancestor scrollTop change', () => {
    const outer = document.createElement('div'); // stands in for the Lab side panel / the page
    const host = document.createElement('div');
    outer.append(host);
    document.body.append(outer);
    const writes: string[] = [];
    const track = (el: Element, name: string): void => {
      Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => 0, set: () => void writes.push(name) });
    };
    track(document.documentElement, 'html');
    track(document.body, 'body');
    track(outer, 'outer');
    track(host, 'host');
    const calls: string[] = [];
    const proto = Element.prototype as unknown as { scrollIntoView?: unknown };
    const had = Object.prototype.hasOwnProperty.call(proto, 'scrollIntoView');
    const saved = proto.scrollIntoView;
    proto.scrollIntoView = function (): void {
      calls.push('scrollIntoView');
    };
    try {
      const ct = new CodeTrace(host);
      const list = host.querySelector<HTMLOListElement>('ol.code-trace-lines')!;
      // a 100 px tall list box; line n sits at (n - 1) * 20 px inside the content
      let listTop = 0;
      Object.defineProperty(list, 'clientHeight', { configurable: true, get: () => 100 });
      Object.defineProperty(list, 'scrollTop', { configurable: true, get: () => listTop, set: (v: number) => void (listTop = v) });
      const rect = (top: number, height: number): DOMRect => ({ top, height, bottom: top + height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
      list.getBoundingClientRect = () => rect(0, 100);
      const place = (): void => {
        list.querySelectorAll<HTMLLIElement>('li').forEach((li) => {
          const n = Number(li.dataset.line);
          li.getBoundingClientRect = () => rect((n - 1) * 20 - listTop, 20);
        });
      };
      const orig = list.replaceChildren.bind(list);
      list.replaceChildren = (...nodes: (Node | string)[]): void => {
        orig(...nodes);
        place();
      };
      ct.update({ title: 't', lines, active: [9] });
      expect(listTop).toBe(9 * 20 - 100); // line 9 brought to the bottom edge of the list box
      ct.update({ title: 't', lines, active: [2] });
      expect(listTop).toBe(20); // back up to line 2's top edge
      ct.update({ title: 't', lines, active: [3] });
      expect(listTop).toBe(20); // already visible: no scroll
      expect(calls).toEqual([]);
      expect(writes).toEqual([]);
    } finally {
      if (had) proto.scrollIntoView = saved;
      else delete proto.scrollIntoView;
    }
  });

  it('destroy removes root', () => {
    const { host, ct } = make();
    ct.destroy();
    expect(host.querySelector('.code-trace')).toBeNull();
  });

  it('active lines carry aria-current', () => {
    const { host, ct } = make();
    ct.update({ title: 't', lines, active: [2, 4] });
    expect([...host.querySelectorAll('li[aria-current="true"]')].map((l) => l.getAttribute('data-line'))).toEqual(['2', '4']);
    expect(host.querySelectorAll('li[aria-current]')).toHaveLength(2);
  });
});
