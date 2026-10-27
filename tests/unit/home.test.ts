// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { concepts } from '../../src/concepts/registry';
import { renderHome } from '../../src/home/main';

function render(): HTMLElement {
  const root = document.createElement('div');
  renderHome(root);
  return root;
}

describe('home page', () => {
  it('one card per concept', () => {
    const root = render();
    expect(root.querySelectorAll('.card').length).toBe(concepts.length);
    expect(concepts.length).toBe(15);
  });

  it('chapters render in book order', () => {
    const root = render();
    const heads = [...root.querySelectorAll('h2')].map((h) => h.textContent ?? '');
    const chapters = [1, 4, 5, 6, 7, 9, 10, 11, 14, 15, 16, 17];
    expect(heads.length).toBe(chapters.length);
    chapters.forEach((ch, i) => expect(heads[i].startsWith(`Bölüm ${ch} ·`), heads[i]).toBe(true));
  });

  it('eleven cards are ready: ... cors-preflight and rate-limiting', () => {
    const root = render();
    const ready = [...root.querySelectorAll('a.card.hazir')];
    expect(ready).toHaveLength(11);
    expect(ready.map((a) => a.getAttribute('href'))).toEqual(['istek-yanit/', 'event-loop/', 'middleware-zinciri/', 'rest-crud/', 'sql-join/', 'katmanli-mimari/', 'salt-hash/', 'jwt-akisi/', 'rbac-401-403/', 'cors-preflight/', 'rate-limiting/']);
  });

  it('hazir cards link to href and ders mode', () => {
    const root = render();
    for (const c of concepts.filter((x) => x.status === 'hazir')) {
      expect(root.querySelector(`a.card.hazir[href="${c.href}"]`), c.id).not.toBeNull();
      expect(root.querySelector(`a[href="${c.href}?mod=ders"]`), c.id).not.toBeNull();
    }
  });

  it('header shows the book', () => {
    const root = render();
    expect(root.querySelector('h1')?.textContent).toBe('Modern Sunucu Tabanlı Programlama');
    expect(root.querySelector('.author')?.textContent).toBe('Prof. Dr. İsmail KIRBAŞ');
  });
});
