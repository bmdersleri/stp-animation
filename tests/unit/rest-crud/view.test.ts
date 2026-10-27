import { describe, expect, it } from 'vitest';
import { listing } from '../../../src/core/listing';
import { LISTINGS } from '../../../src/concepts/rest-crud/code-text';
import { TUMU, restScenario, type RestParams } from '../../../src/concepts/rest-crud/scenario';
import { REST_LANES, deriveRestView, restLabRozet, restSira } from '../../../src/concepts/rest-crud/view';

const adim = (id: string): RestParams => ({ ...restScenario.defaults, ...restScenario.steps.find((s) => s.id === id)!.params });
const terminal = (v: ReturnType<typeof deriveRestView>): string[] => v.http.terminal.map((t) => t.metin);
const cikti = listing(LISTINGS, 'laboratuvar-api-cikti').lines;

describe('rest-crud view', () => {
  it('restSira joins earlier requests and the repeated one', () => {
    expect(restSira({ ...adim('mutlak-goreli') })).toEqual(['stok-ayarla-5', 'stok-ayarla-5', 'stok-artir-1', 'stok-artir-1']);
  });

  it('step 1 shows lanes and the Kod 6.1 output', () => {
    const v = deriveRestView(adim('tanitim'));
    expect(v.sequence.lanes.map((l) => l.id)).toEqual(['istemci', 'rota', 'servis', 'veri']);
    expect(v.sequence.messages).toEqual([]);
    expect(terminal(v)).toEqual(['/api/ekipmanlar', '/api/ekipmanlar/12']);
    expect(v.code.title).toBe('Kod 6.1 · RestKaynaklari.ts');
    expect(v.tablo).toBeNull();
    expect(REST_LANES[2].sub).toBe('LaboratuvarApi');
  });

  it('step 2 adds row 3 as new', () => {
    const v = deriveRestView(adim('olustur'));
    const satir = v.tablo!.satirlar.find((r) => r.key === '3')!;
    expect(satir.state).toBe('yeni');
    expect(satir.cells).toEqual([3, 'Santrifüj', 'musait']);
    expect(v.http.yanitlar[0]).toMatchObject({ durumKodu: 201, durumMetni: 'Created', basliklar: [['Location', '/api/ekipmanlar/3']] });
    expect(v.http.istek).toMatchObject({ metot: 'POST', yol: '/api/ekipmanlar' });
    expect(terminal(v)).toEqual(cikti.slice(0, 6));
    expect(v.sequence.stopAt).toBe('istemci');
    expect(v.sequence.stopTone).toBe('ok');
    expect(v.sequence.active).toBe(v.sequence.messages[v.sequence.messages.length - 1].id);
    expect(v.code.title).toBe('LaboratuvarApi · ChapterMiniApp.ts');
    expect(v.code.active.length).toBeGreaterThan(0);
  });

  it('step 3 lists two rows with toplamKayit 3', () => {
    const v = deriveRestView(adim('listele'));
    expect(terminal(v)).toEqual(cikti.slice(6, 15));
    expect(terminal(v).at(-2)).toContain('toplamKayit: 3');
    expect(v.tablo!.satirlar.map((r) => r.state)).toEqual(['etkin', 'etkin', undefined]);
    expect(v.http.yanitlar.map((y) => [y.sira, y.durumKodu])).toEqual([[1, 201], [2, 200]]);
  });

  it('step 4 marks the durum cell changed', () => {
    const v = deriveRestView(adim('guncelle'));
    const satir = v.tablo!.satirlar.find((r) => r.key === '1')!;
    expect(satir).toMatchObject({ state: 'degisti', changed: [2], cells: [1, 'Mikroskop', 'rezerve'] });
    expect(terminal(v)).toEqual(cikti.slice(15, 21));
  });

  it('step 5 is a 404 that stops at the client in alarm', () => {
    const v = deriveRestView(adim('bulunamadi'));
    expect(terminal(v)).toEqual(cikti.slice(21));
    expect(v.sequence.stopTone).toBe('alarm');
    expect(v.http.yanitlar.at(-1)).toMatchObject({ durumKodu: 404, sira: 4 });
    expect(v.http.yanitlar).toHaveLength(3);
    expect(v.tablo!.satirlar.some((r) => r.state)).toBe(false);
  });

  it('step 6 is a 400 and leaves the table unchanged', () => {
    const v = deriveRestView(adim('gecersiz'));
    expect(v.http.yanitlar[0].durumKodu).toBe(400);
    expect(v.tablo!.satirlar.map((r) => r.key)).toEqual(['1', '2']);
  });

  it('step 7 shows two responses 204 then 404', () => {
    const v = deriveRestView(adim('sil'));
    expect(v.sira).toEqual(['delete-12', 'delete-12']);
    expect(v.http.yanitlar.map((y) => [y.sira, y.durumKodu])).toEqual([[1, 204], [2, 404]]);
    expect(terminal(v)).toEqual(['DELETE 1: 204 kalan: 0', 'DELETE 2: 404 kalan: 0']);
    expect(v.code.title).toBe('Idempotentlik.ts');
    expect(v.sequence.lanes[2].sub).toBe('Idempotentlik.ts');
    expect(v.tablo!.baslik).toBe('ekipmanlar');
  });

  it('a delete row stays struck through in the send that deleted it', () => {
    const bir = deriveRestView({ ...adim('sil'), gonderim: 1 });
    expect(bir.tablo!.satirlar).toEqual([{ key: '12', cells: [12, 'Santrifüj'], state: 'silindi' }]);
    expect(bir.http.yanitlar).toHaveLength(1);
    expect(terminal(bir)).toEqual(['DELETE 1: 204 kalan: 0']);
    expect(deriveRestView(adim('sil')).tablo!.satirlar).toEqual([]);
  });

  it('step 8 terminal and no request card', () => {
    const v = deriveRestView(adim('mutlak-goreli'));
    expect(terminal(v)).toEqual(['Mutlak atama iki kez: 5', 'Göreli artış iki kez: 7']);
    expect(v.http.istek).toBeUndefined();
    expect(v.http.yanitlar).toEqual([]);
    expect(v.tablo).toMatchObject({ baslik: 'stok' });
    expect(v.tablo!.satirlar).toEqual([{ key: 'mikroskop', cells: ['mikroskop', 7], state: 'degisti', changed: [1] }]);
    expect(v.sequence.stopAt).toBe('servis');
  });

  it('step 9 responses 201 201 422', () => {
    const v = deriveRestView(adim('idempotency-key'));
    expect(v.http.yanitlar.map((y) => y.durumKodu)).toEqual([201, 201, 422]);
    expect(v.http.yanitlar.map((y) => y.sira)).toEqual([1, 2, 3]);
    expect(terminal(v)).toEqual(['POST yanıtları: 201 201 422', 'Oluşan rezervasyon sayısı: 1']);
    expect(v.tablo).toMatchObject({ baslik: 'rezervasyonlar', not: 'islenmisAnahtarlar: rzv-7f3a' });
    expect(v.tablo!.satirlar).toHaveLength(1);
    expect(v.sequence.stopTone).toBe('alarm');
  });

  it('gonderim is clamped', () => {
    const lo = deriveRestView({ ...adim('sil'), gonderim: 0 });
    expect(lo.http.yanitlar).toHaveLength(1);
    const hi = deriveRestView({ ...adim('sil'), gonderim: TUMU });
    expect(hi.http.yanitlar).toHaveLength(2);
    expect(deriveRestView({ ...adim('sil'), gonderim: 2 })).toEqual(hi);
  });

  it('ozet has five method rows and six endpoint lines', () => {
    const v = deriveRestView(adim('ozet'));
    expect(v.ozet!.metotlar).toHaveLength(5);
    expect(v.ozet!.metotlar.map((r) => r[0])).toEqual(['GET', 'PUT', 'DELETE', 'PATCH', 'POST']);
    expect(v.ozet!.metotlar[2]).toEqual(['DELETE', 'Hayır', 'Evet', 'Kaynak zaten silinmiştir; yanıt 404 olabilir']);
    expect(v.ozet!.basarilar).toHaveLength(6);
    expect(v.ozet!.basarilar[2]).toBe('POST /api/rezervasyonlar -> 201');
    expect(v.ozet!.basarilar[5]).toBe('GET /api/ekipmanlar?durum=musait -> 200');
    expect(deriveRestView(adim('olustur')).ozet).toBeNull();
  });

  it('lab badge is the step badge for a book request and kitap-kodu otherwise', () => {
    expect(restLabRozet(adim('sil'))).toEqual({ tur: 'kitap', ref: 'L643-644' });
    expect(restLabRozet(adim('olustur'))).toEqual({ tur: 'kitap' });
    expect(restLabRozet({ ...adim('olustur'), istek: 'get-1' })).toEqual({ tur: 'kitap-kodu' });
    expect(restLabRozet({ ...adim('sil'), tekrar: 3 })).toEqual({ tur: 'kitap-kodu' });
  });
});
