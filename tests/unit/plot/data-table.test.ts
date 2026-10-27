// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DataTable, type DataTableSpec } from '../../../src/core/plot/data-table';

const spec = (extra: Partial<DataTableSpec> = {}): DataTableSpec => ({
  baslik: 'kitapListesi',
  sutunlar: [{ ad: 'kitap_id', anahtar: 'PK' }, { ad: 'ad' }, { ad: 'yazar_id', anahtar: 'FK' }],
  satirlar: [
    { key: 'k1', cells: [1, 'İnce Memed', 7] },
    { key: 'k2', cells: [2, 'Orta Direk', null] },
  ],
  ...extra,
});
const make = (): { host: HTMLElement; t: DataTable } => {
  const host = document.createElement('div');
  document.body.append(host);
  return { host, t: new DataTable(host) };
};

describe('DataTable', () => {
  it('null cell renders NULL with class null', () => {
    const { host, t } = make();
    t.update(spec());
    const td = host.querySelector('tr[data-key="k2"] td:nth-child(3)')!;
    expect(td.textContent).toBe('NULL');
    expect(td.classList.contains('null')).toBe(true);
    expect(host.querySelector('.data-table-title')!.textContent).toBe('kitapListesi');
  });

  it('row state class', () => {
    const { host, t } = make();
    t.update(spec({ satirlar: [{ key: 'k1', cells: [1, 'a', 2], state: 'yeni' }, { key: 'k2', cells: [2, 'b', 3] }] }));
    expect(host.querySelector('tr[data-key="k1"]')!.classList.contains('satir-yeni')).toBe(true);
    expect(host.querySelector('tr[data-key="k2"]')!.className).toBe('');
  });

  it('changed cells marked', () => {
    const { host, t } = make();
    t.update(spec({ satirlar: [{ key: 'k1', cells: [1, 'a', 2], state: 'degisti', changed: [1] }] }));
    expect([...host.querySelectorAll('tr[data-key="k1"] td')].map((td) => td.classList.contains('degisti'))).toEqual([false, true, false]);
  });

  it('PK and FK badges in headers', () => {
    const { host, t } = make();
    t.update(spec({ not: 'Not metni' }));
    expect([...host.querySelectorAll('thead th .anahtar-rozeti')].map((b) => b.textContent)).toEqual(['PK', 'FK']);
    expect(host.querySelector('p.data-table-not')!.textContent).toBe('Not metni');
    t.update(spec());
    expect(host.querySelector('p.data-table-not')).toBeNull();
  });

  it('keyed rows are reused and missing rows removed', () => {
    const { host, t } = make();
    t.update(spec());
    const k1 = host.querySelector('tr[data-key="k1"]');
    t.update(spec({ satirlar: [{ key: 'k1', cells: [1, 'Değişti', 7], state: 'degisti', changed: [1] }, { key: 'k3', cells: [3, 'Yeni', 7] }] }));
    expect(host.querySelector('tr[data-key="k1"]')).toBe(k1);
    expect(host.querySelector('tr[data-key="k2"]')).toBeNull();
    expect([...host.querySelectorAll('tbody tr')].map((r) => r.getAttribute('data-key'))).toEqual(['k1', 'k3']);
    expect(k1!.textContent).toContain('Değişti');
    expect(host.querySelectorAll('table')).toHaveLength(1);
  });
});
