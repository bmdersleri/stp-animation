import { describe, expect, it } from 'vitest';
import { listing } from '../../../src/core/listing';
import {
  calistirSira,
  gonder,
  idemTerminal,
  IDEM_BASLANGIC,
  LAB_BASLANGIC,
  type IdemDurum,
  type LabDurum,
} from '../../../src/concepts/rest-crud/api';
import { LISTINGS } from '../../../src/concepts/rest-crud/code-text';
import { ISTEKLER, type IstekId } from '../../../src/concepts/rest-crud/rota';

const KITAP_CIKTI = `{
  durumKodu: 201,
  basarili: true,
  veri: { kimlik: 3, ad: 'Santrifüj', durum: 'musait' },
  mesaj: 'Ekipman oluşturuldu.'
}
{
  durumKodu: 200,
  basarili: true,
  veri: [
    { kimlik: 1, ad: 'Mikroskop', durum: 'musait' },
    { kimlik: 2, ad: 'Spektrometre', durum: 'rezerve' }
  ],
  metadata: { sayfa: 1, sayfaBoyutu: 2, toplamKayit: 3 }
}
{
  durumKodu: 200,
  basarili: true,
  veri: { kimlik: 1, ad: 'Mikroskop', durum: 'rezerve' },
  mesaj: 'Ekipman durumu güncellendi.'
}
{
  durumKodu: 404,
  basarili: false,
  hataKodu: 'EKIPMAN_BULUNAMADI',
  mesaj: 'İstenen ekipman bulunamadı.'
}`;

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(deepFreeze);
    Object.freeze(v);
  }
  return v;
}
const lab = (sira: IstekId[]) => calistirSira('laboratuvar-api', sira);
const idem = (sira: IstekId[]) => calistirSira('idempotentlik', sira);
const kodlar = (r: { gonderimler: { yanit?: { durumKodu: number } }[] }) => r.gonderimler.map((g) => g.yanit?.durumKodu);
const location = (g: { yanit?: { basliklar?: readonly [string, string][] } }) => g.yanit?.basliklar?.find(([k]) => k === 'Location')?.[1];

describe('rest-crud api', () => {
  it('book program output', () => {
    const r = lab(['post-santrifuj', 'get-liste-1-2', 'patch-1-rezerve', 'get-99']);
    expect(r.gonderimler.flatMap((g) => g.cikti).join('\n')).toBe(KITAP_CIKTI);
    expect(r.durumlar).toHaveLength(4);
  });

  it('idempotentlik book lines', () => {
    const sira: IstekId[] = ['stok-ayarla-5', 'stok-ayarla-5', 'stok-artir-1', 'stok-artir-1', 'delete-12', 'delete-12', 'post-anahtar-7', 'post-anahtar-7', 'post-anahtar-9'];
    expect(idemTerminal(sira, idem(sira).gonderimler)).toEqual([
      'Mutlak atama iki kez: 5',
      'Göreli artış iki kez: 7',
      'DELETE 1: 204 kalan: 0',
      'DELETE 2: 404 kalan: 0',
      'POST yanıtları: 201 201 422',
      'Oluşan rezervasyon sayısı: 1',
    ]);
  });

  it('idempotentlik: only two calls print the book literal "iki kez"; other counts are the page summary', () => {
    const bir: IstekId[] = ['stok-ayarla-5'];
    expect(idemTerminal(bir, idem(bir).gonderimler)).toEqual(['// sayfa özeti: stokuAyarla(5) 1 kez, stok: 5']);
    const uc: IstekId[] = ['stok-artir-1', 'stok-artir-1', 'stok-artir-1'];
    const satir = idemTerminal(uc, idem(uc).gonderimler);
    expect(satir).toHaveLength(1);
    expect(satir[0]).toMatch(/^\/\/ sayfa özeti: stokuArtir\(1\) 3 kez, stok: \d+$/);
    expect(satir[0]).not.toContain('iki kez');
  });

  it('POST twice creates ids 3 and 4', () => {
    const r = lab(['post-santrifuj', 'post-santrifuj']);
    expect(r.gonderimler.map((g) => (JSON.parse(g.yanit!.govde!) as { veri: { kimlik: number } }).veri.kimlik)).toEqual([3, 4]);
    expect((r.durumlar[1] as LabDurum).ekipmanListesi).toHaveLength(4);
    expect((r.durumlar[1] as LabDurum).sonrakiKimlik).toBe(5);
  });

  it('GET does not change state', () => {
    const r = lab(['get-liste-1-2', 'get-1', 'get-99']);
    r.durumlar.forEach((d) => expect(d).toEqual(LAB_BASLANGIC));
  });

  it('empty name gives 400 GECERSIZ_AD and leaves state', () => {
    const r = lab(['post-bos']);
    expect(r.gonderimler[0].yanit!.durumKodu).toBe(400);
    expect(r.gonderimler[0].yanit!.govde).toContain('GECERSIZ_AD');
    expect(r.durumlar[0]).toEqual(LAB_BASLANGIC);
  });

  it('page 0 gives 400 GECERSIZ_SAYFA', () => {
    const g = lab(['get-liste-0-2']).gonderimler[0];
    expect(g.yanit!.durumKodu).toBe(400);
    expect(g.yanit!.govde).toContain('GECERSIZ_SAYFA');
  });

  it('PATCH 99 gives 404', () => {
    const r = lab(['patch-99']);
    expect(r.gonderimler[0].yanit!.durumKodu).toBe(404);
    expect(r.durumlar[0]).toEqual(LAB_BASLANGIC);
  });

  it('Location only on 201', () => {
    const r = lab(['post-santrifuj', 'get-1', 'get-99', 'post-bos']);
    expect(r.gonderimler.map(location)).toEqual(['/api/ekipmanlar/3', undefined, undefined, undefined]);
    const i = idem(['delete-12', 'delete-12', 'post-anahtar-7', 'post-anahtar-9']);
    expect(i.gonderimler.map(location)).toEqual([undefined, undefined, '/api/rezervasyonlar/1', undefined]);
  });

  it('204 has no body', () => {
    const y = idem(['delete-12']).gonderimler[0].yanit!;
    expect(y.durumKodu).toBe(204);
    expect(y.durumMetni).toBe('No Content');
    expect(y.govde).toBeNull();
  });

  it('DELETE twice: 204 then 404, state stays', () => {
    const r = idem(['delete-12', 'delete-12']);
    expect(kodlar(r)).toEqual([204, 404]);
    expect(r.durumlar[1]).toEqual(r.durumlar[0]);
    expect((r.durumlar[1] as IdemDurum).ekipmanlar).toHaveLength(0);
  });

  it('same key same body replays the first response', () => {
    const r = idem(['post-anahtar-7', 'post-anahtar-7']);
    expect(r.gonderimler[1].yanit!.govde).toBe(r.gonderimler[0].yanit!.govde);
    expect(kodlar(r)).toEqual([201, 201]);
    expect((r.durumlar[1] as IdemDurum).rezervasyonlar).toHaveLength(1);
  });

  it('same key other body gives 422 ANAHTAR_FARKLI_GOVDE', () => {
    const r = idem(['post-anahtar-7', 'post-anahtar-9']);
    const y = r.gonderimler[1].yanit!;
    expect(y.durumKodu).toBe(422);
    expect(y.durumMetni).toBe('Unprocessable Content');
    expect(y.govde).toContain('ANAHTAR_FARKLI_GOVDE');
    expect((r.durumlar[1] as IdemDurum).rezervasyonlar).toHaveLength(1);
  });

  it('stok sends have no HTTP request', () => {
    const r = idem(['stok-ayarla-5', 'stok-artir-1']);
    r.gonderimler.forEach((g) => {
      expect(g.istek).toBeUndefined();
      expect(g.yanit).toBeUndefined();
      expect(g.olaylar.map((o) => `${o.from}>${o.to}`)).toEqual(['servis>veri', 'veri>servis']);
    });
    expect((r.durumlar[1] as IdemDurum).stok).toBe(6);
  });

  it('HTTP sends have the full lane flow', () => {
    const g = lab(['get-99']).gonderimler[0];
    expect(g.olaylar.map((o) => `${o.from}>${o.to}`)).toEqual([
      'istemci>rota', 'rota>servis', 'servis>veri', 'veri>servis', 'servis>servis', 'servis>rota', 'rota>istemci',
    ]);
    expect(g.olaylar[0].label).toBe('GET /api/ekipmanlar/99');
    expect(g.olaylar.at(-1)!.label).toBe('404 Not Found');
    expect(g.olaylar[2].label).toBe('find(kimlik === 99)');
    expect(g.olaylar.at(-1)!.tone).toBe('alarm');
  });

  it('input state is not mutated', () => {
    const l = deepFreeze(structuredClone(LAB_BASLANGIC));
    const i = deepFreeze(structuredClone(IDEM_BASLANGIC));
    for (const t of ISTEKLER['laboratuvar-api']) expect(() => gonder('laboratuvar-api', l, t.id)).not.toThrow();
    for (const t of ISTEKLER.idempotentlik) expect(() => gonder('idempotentlik', i, t.id)).not.toThrow();
    const patched = gonder('laboratuvar-api', l, 'patch-1-rezerve').durum as LabDurum;
    expect(patched.ekipmanListesi[0].durum).toBe('rezerve');
    expect(l.ekipmanListesi[0].durum).toBe('musait');
  });

  it('start states', () => {
    expect(LAB_BASLANGIC.sonrakiKimlik).toBe(3);
    expect(LAB_BASLANGIC.ekipmanListesi.map((e) => e.durum)).toEqual(['musait', 'rezerve']);
    expect(IDEM_BASLANGIC).toEqual({ stok: 3, ekipmanlar: [[12, 'Santrifüj']], rezervasyonlar: [], anahtarlar: [] });
  });

  it('unknown request id falls back to the first', () => {
    const a = gonder('laboratuvar-api', LAB_BASLANGIC, 'yok' as IstekId);
    const b = gonder('laboratuvar-api', LAB_BASLANGIC, 'post-santrifuj');
    expect(a).toEqual(b);
  });

  it('every event line points into its listing', () => {
    for (const p of ['laboratuvar-api', 'idempotentlik'] as const) {
      const n = listing(LISTINGS, p).lines.length;
      const r = calistirSira(p, ISTEKLER[p].map((x) => x.id));
      r.gonderimler.forEach((g) => {
        expect(g.satirlar).toHaveLength(g.olaylar.length);
        g.satirlar.forEach((s) => {
          expect(s).toBeGreaterThanOrEqual(1);
          expect(s).toBeLessThanOrEqual(n);
        });
      });
    }
  });

  it('idempotentlik sends highlight the call site, not the definition', () => {
    const l = listing(LISTINGS, 'idempotentlik');
    for (const t of ISTEKLER.idempotentlik.filter((x) => x.istek)) {
      const g = gonder('idempotentlik', IDEM_BASLANGIC, t.id).gonderim;
      expect(l.lines[g.satirlar[0] - 1]).toContain(t.cagri);
      expect(l.lines[g.satirlar[g.satirlar.length - 1] - 1]).toContain(t.cagri);
    }
  });

  it('listings match the book', () => {
    expect(listing(LISTINGS, 'laboratuvar-api').lines[0]).toBe('// File: ChapterMiniApp.ts');
    expect(listing(LISTINGS, 'idempotentlik-cikti').lines).toHaveLength(6);
    expect(LISTINGS.map((l) => l.id)).toEqual(['kod-6-1', 'kod-6-1-cikti', 'laboratuvar-api', 'laboratuvar-api-cikti', 'idempotentlik', 'idempotentlik-cikti', 'kod-6-5']);
  });
});
