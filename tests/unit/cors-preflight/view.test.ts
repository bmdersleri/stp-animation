import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/cors-preflight/code-text';
import { corsScenario as sc, TUMU, type CorsParams } from '../../../src/concepts/cors-preflight/scenario';
import { CORS_LANES, corsLabRozet, deriveCorsView } from '../../../src/concepts/cors-preflight/view';
import { calistir } from '../../../src/concepts/cors-preflight/tarayici';
import { listing } from '../../../src/core/listing';

const step = (n: number): CorsParams => sc.steps[n - 1].params as CorsParams;
const view = (n: number, kitapCiktisi = true) => deriveCorsView(step(n), kitapCiktisi);
const K7 = listing(LISTINGS, 'kod-11-7');
const L1208 = K7.lines[K7.lines.length - 1].replace('// Çıktı: ', '');

describe('cors-preflight view', () => {
  it('lanes', () => {
    expect(CORS_LANES.map((l) => [l.id, l.label[0]])).toEqual([['betik', 'Sayfa betiği (köken)'], ['tarayici', 'Tarayıcı'], ['sunucu', 'API sunucusu']]);
  });

  it('step 3 TypeError arrow and server processed', () => {
    const v = view(3);
    const son = v.sequence.messages[v.sequence.messages.length - 1];
    expect(son).toMatchObject({ from: 'tarayici', to: 'betik', label: 'TypeError', tone: 'alarm' });
    expect(v.sequence.stopAt).toBe('tarayici');
    expect(v.sequence.ariaLabel).toBe('CORS sıra diyagramı');
    expect(v.http.yanitlar[0].durumKodu).toBe(200);
    expect(v.aciklama).toBe('Tarayıcı yanıtı betiğe vermedi; sunucu isteği işledi.');
    expect(v.denetim!.baslik).toBe('Tarayıcı denetimi (asıl yanıt)');
    expect(v.kokenler).toEqual({ sayfa: 'https://kotu-niyetli-site.com', api: 'https://api.kutuphane.mehmetakif.edu.tr' });
  });

  it('step 7 shows only fetch and OPTIONS', () => {
    const v = view(7);
    expect(v.sequence.messages.map((m) => m.id)).toEqual(['fetch', 'pre-istek']);
    expect(v.sequence.messages[1].label).toMatch(/^OPTIONS /);
    expect(v.http.istek!.metot).toBe('OPTIONS');
    expect(v.http.yanitlar).toEqual([]);
    expect(v.denetim).toBeNull();
    expect(v.aciklama).toBeNull();
    expect(v.sequence.stopAt).toBeUndefined();
  });

  it('step 8 Allow-Headers yok row and no POST arrow', () => {
    const v = view(8);
    expect(v.http.yanitlar).toHaveLength(1);
    expect(v.http.yanitlar[0]).toMatchObject({ sira: 1, eksikBasliklar: ['Access-Control-Allow-Headers'] });
    expect(v.sequence.messages.some((m) => m.label.startsWith('POST'))).toBe(false);
    expect(v.denetim!.baslik).toBe('Tarayıcı denetimi (preflight)');
    expect(v.denetim!.denetimler.find((d) => d.ad === 'Allow-Headers')!.durum).toBe('kaldi');
    expect(v.aciklama).toBe('Asıl istek hiç gönderilmedi.');
    expect(v.sequence.stopAt).toBe('tarayici');
  });

  it('step 9 two responses with sira 1 and 2', () => {
    const v = view(9);
    expect(v.http.yanitlar.map((y) => y.sira)).toEqual([1, 2]);
    expect(v.http.istek!.metot).toBe('POST');
    expect(v.sequence.messages.some((m) => m.label.startsWith('OPTIONS'))).toBe(true);
    expect(v.sequence.stopAt).toBe('betik');
    expect(v.sequence.stopTone).toBe('ok');
    expect(v.code.notes).toEqual({ [v.code.active[0]]: 'preflight’ı `cors` paketi yanıtlar (L646)' });
  });

  it('step 4 terminal is L1208', () => {
    const v = view(4, true);
    expect(v.http.terminal).toEqual([{ metin: L1208 }]);
    expect(v.http.yanitlar[0].durumKodu).toBe(403);
    expect(v.http.istek!.basliklar).toContainEqual(['Origin', 'https://kotu-niyetli-site.com']);
    expect(v.aciklama).toBe('Kitap bu çağrıyı doğrudan fonksiyonla yapar (L1201-1206); burada aynı istek curl ile Origin başlığı verilerek gönderilir.');
    expect(v.code.lines[v.code.active[0] - 1]).toContain('if (!izinVerilenKokenler.includes(kaynakKoken))');
  });

  it('step 4 book line is absent without kitapCiktisi', () => {
    const v = view(4, false);
    expect(v.http.terminal).toEqual([]);
  });

  it('curl dims browser lane', () => {
    const v = view(5);
    expect(v.sequence.dim).toEqual(['tarayici']);
    expect(v.sequence.lanes[0]).toEqual({ id: 'betik', label: ['curl'] });
    expect(v.http.istek!.kaynak).toBe('curl');
    expect(v.sequence.stopAt).toBe('betik');
    expect(view(2).sequence.dim).toBeUndefined();
    expect(view(2).sequence.lanes[0].label).toEqual(['Sayfa betiği (köken)']);
  });

  it('code strip lines follow the server kind', () => {
    const satir = (n: number) => {
      const v = view(n);
      return v.code.lines[v.code.active[0] - 1].trim();
    };
    expect(view(2).code.title).toContain('Kod 11.4');
    expect(satir(2)).toContain('if (!istekKokeni ||');
    expect(view(6).code.title).toContain('Yanlış');
    expect(satir(6)).toBe('"Access-Control-Allow-Origin": "*",');
    expect(view(1).code.active).toEqual([]);
  });

  it('intro has empty trace and no checks', () => {
    const v = view(1);
    expect(v.sequence.messages).toEqual([]);
    expect(v.http).toEqual({ yanitlar: [], terminal: [] });
    expect(v.denetim).toBeNull();
    expect(v.ozet).toBe(false);
    expect(view(10).ozet).toBe(true);
  });

  it('lab badge standart only when preflight ran', () => {
    expect(corsLabRozet(step(8))).toEqual({ tur: 'standart', ref: 'Fetch' });
    expect(corsLabRozet(step(2))).toEqual({ tur: 'kitap-kodu' });
    expect(corsLabRozet({ ...step(8), istemci: 'curl' })).toEqual({ tur: 'kitap-kodu' });
  });

  it('olay is clamped to trace length', () => {
    const tum = calistir(step(9)).olaylar.length;
    expect(deriveCorsView({ ...step(9), olay: TUMU }).sequence.messages).toHaveLength(tum);
    expect(deriveCorsView({ ...step(9), olay: tum + 5 }).sequence.messages).toHaveLength(tum);
    expect(deriveCorsView({ ...step(9), olay: 0 }).sequence.messages).toHaveLength(1);
    expect(deriveCorsView({ ...step(9), olay: 3 }).sequence.messages).toHaveLength(3);
  });
});
