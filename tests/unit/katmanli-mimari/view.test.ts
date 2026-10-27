import { describe, expect, it } from 'vitest';
import { TUMU, type KatmanParams } from '../../../src/concepts/katmanli-mimari/scenario';
import { KATMAN_LANES, baslangicDurumu, deriveKatmanView, katmanLabRozet } from '../../../src/concepts/katmanli-mimari/view';
import { istekKarsila } from '../../../src/concepts/katmanli-mimari/katmanlar';

const base: KatmanParams = {
  ogrenciNumarasi: '2024001',
  kitapKodu: 'JAVA-101',
  uygunMu: true,
  mevcutOduncSayisi: 0,
  tekrar: 1,
  olay: 0,
  gorunum: 'akis',
};
const tam = (p: Partial<KatmanParams>): KatmanParams => ({ ...base, ...p, olay: TUMU });
const son = <T>(a: readonly T[]): T => a[a.length - 1];
const iz = istekKarsila(baslangicDurumu(base), { ogrenciNumarasi: '2024001', kitapKodu: 'JAVA-101' }).olaylar;
const hesap = (f: (o: (typeof iz)[number]) => boolean): number => iz.findIndex(f) + 1;
const olayOkuma = hesap((o) => o.tur === 'donus' && o.etiket.startsWith('Öğrenci'));
const olayYanEtki = hesap((o) => o.tur === 'donus' && o.etiket.startsWith('mevcutOduncSayisi'));

describe('katmanli-mimari view', () => {
  it('has the five lanes', () => {
    expect(KATMAN_LANES.map((l) => l.id)).toEqual(['cagiran', 'controller', 'service', 'kitapRepo', 'ogrenciRepo']);
    expect(KATMAN_LANES[0]).toMatchObject({ label: ['Çağıran kod'], sub: 'console.log(…)' });
    expect(KATMAN_LANES[3].label).toEqual(['KitapRepository']);
    const v = deriveKatmanView(base);
    expect(v.sequence.lanes).toEqual(KATMAN_LANES);
    expect(v.sequence.messages).toEqual([]);
    expect(v.sequence.ariaLabel).toBe('Katmanlı mimari sıra diyagramı');
    expect(v.http.istek).toBeUndefined();
    expect(v.http.yanitlar).toEqual([]);
    expect(v.yasam).toBeNull();
    expect(v.ozet).toBeNull();
  });

  it('kurulum shows the four new calls', () => {
    const v = deriveKatmanView({ ...base, gorunum: 'kurulum' });
    expect(v.sequence.messages.map((m) => [m.from, m.to, m.kind])).toEqual([
      ['cagiran', 'kitapRepo', 'request'],
      ['cagiran', 'ogrenciRepo', 'request'],
      ['cagiran', 'service', 'request'],
      ['cagiran', 'controller', 'request'],
    ]);
    expect(v.code.active).toHaveLength(4);
    v.code.active.forEach((n) => expect(v.code.lines[n - 1]).toContain('= new '));
  });

  it('step 4 marks both read rows active', () => {
    const v = deriveKatmanView({ ...base, olay: olayOkuma });
    expect(v.kitaplar.satirlar[0].state).toBe('etkin');
    expect(v.ogrenciler.satirlar[0].state).toBe('etkin');
    expect(deriveKatmanView({ ...base, olay: 3 }).kitaplar.satirlar[0].state).toBeUndefined();
  });

  it('step 6 marks the changed cells', () => {
    const v = deriveKatmanView({ ...base, olay: olayYanEtki });
    expect(v.kitaplar.satirlar[0]).toMatchObject({ state: 'degisti', changed: [2], cells: ['JAVA-101', 'Java ile Programlama', false] });
    expect(v.ogrenciler.satirlar[0]).toMatchObject({ state: 'degisti', changed: [1], cells: ['2024001', 1] });
    expect(v.kitaplar.sutunlar[0]).toEqual({ ad: 'kod', anahtar: 'PK' });
    expect(v.ogrenciler.sutunlar[0]).toEqual({ ad: 'numara', anahtar: 'PK' });
  });

  it('step 7 terminal is the book output', () => {
    const v = deriveKatmanView(tam({}));
    expect(v.http.terminal.map((t) => t.metin)).toEqual([
      '{',
      '  durumKodu: 201,',
      "  mesaj: 'Java ile Programlama başarıyla ödünç verildi.'",
      '}',
    ]);
    expect(v.http.yanitlar).toEqual([
      { durumKodu: 201, durumMetni: 'Created', govde: 'Java ile Programlama başarıyla ödünç verildi.' },
    ]);
    expect(v.sequence.stopAt).toBe('cagiran');
    expect(v.sequence.stopTone).toBe('ok');
    expect(v.sequence.dim).toEqual([]);
    expect(son(v.sequence.messages).kind).toBe('note');
    const resp = v.sequence.messages.find((m) => m.to === 'cagiran' && m.kind === 'response');
    expect(resp).toMatchObject({ from: 'controller', tone: 'ok' });
    // decisive line: the service's success return
    expect(v.code.lines[(v.karar ?? 0) - 1]).toContain('return `${kitap.ad} başarıyla ödünç verildi.`');
  });

  it('step 8 has an alarm throw from service to controller and two responses', () => {
    const v = deriveKatmanView(tam({ tekrar: 2 }));
    const firlat = v.sequence.messages.find((m) => m.from === 'service' && m.to === 'controller' && m.tone === 'alarm');
    expect(firlat).toMatchObject({ kind: 'response', label: 'Error("Kitap uygun değildir.")' });
    expect(v.http.yanitlar.map((y) => [y.durumKodu, y.sira, y.govde])).toEqual([
      [201, 1, 'Java ile Programlama başarıyla ödünç verildi.'],
      [400, 2, 'Kitap uygun değildir.'],
    ]);
    expect(v.sequence.stopTone).toBe('alarm');
    expect(v.sequence.dim).toEqual([]);
    expect(v.http.terminal.map((t) => t.metin).slice(4)).toEqual(["{ durumKodu: 400, mesaj: 'Kitap uygun değildir.' }"]);
    expect(v.code.lines[(v.karar ?? 0) - 1]).toContain('throw new Error("Kitap uygun değildir.")');
    // first call is complete: its response is visible before the second one starts
    expect(deriveKatmanView({ ...base, tekrar: 2, olay: 1 }).http.yanitlar.map((y) => y.durumKodu)).toEqual([201]);
  });

  it('step 9 dims service and both repositories', () => {
    const v = deriveKatmanView(tam({ kitapKodu: '' }));
    expect(v.sequence.dim).toEqual(['service', 'kitapRepo', 'ogrenciRepo']);
    expect(v.http.yanitlar[0]).toMatchObject({ durumKodu: 400, govde: 'Zorunlu alanlar eksiktir.' });
    expect(v.http.terminal.map((t) => t.metin)).toEqual(["{ durumKodu: 400, mesaj: 'Zorunlu alanlar eksiktir.' }"]);
    expect(v.code.lines[(v.karar ?? 0) - 1]).toContain('return { durumKodu: 400, mesaj: "Zorunlu alanlar eksiktir." }');
  });

  it('step 10 dims the Yok rows', () => {
    const v = deriveKatmanView({ ...base, gorunum: 'yasam' });
    const y = v.yasam!;
    expect(y.sutunlar.map((s) => s.ad)).toEqual(['Adım', 'Katman / Bileşen', 'Kod 9.14']);
    expect(y.satirlar).toHaveLength(11);
    expect(y.satirlar.filter((s) => s.state === 'soluk').map((s) => s.key)).toEqual(['1', '2', '11']);
    expect(y.satirlar.filter((s) => s.state === 'etkin')).toHaveLength(8);
    expect(y.satirlar[0].cells).toEqual(['1. İstek Girişi', 'HTTP Taşıma Katmanı', 'Yok']);
    expect(y.satirlar[3].cells[1]).toBe('Controller → Service');
    expect(y.satirlar[1].cells[2]).toBe('Yok; istekKarsila doğrudan çağrılır');
    expect(y.not).toBe("Tablo bilinçli olarak Kod 9.14'ün yaptığından fazlasını gösterir.");
  });

  it('step 11 shows the responsibility matrix', () => {
    const v = deriveKatmanView({ ...base, gorunum: 'ozet' });
    const o = v.ozet!;
    expect(o.sutunlar.map((s) => s.ad)).toEqual(['Katman', 'Ne yapmaz?']);
    expect(o.satirlar).toHaveLength(6);
    expect(o.satirlar[1].cells[0]).toBe('Controller (Kontrolcü)');
    expect(o.satirlar[2].cells[1]).toContain('HTTP protokol detaylarını (req, res, header, status code) bilmez');
  });

  it('limit branch from the lab start', () => {
    const v = deriveKatmanView(tam({ mevcutOduncSayisi: 3 }));
    expect(v.http.yanitlar[0]).toMatchObject({ durumKodu: 400, govde: 'Öğrenci limitine ulaştı.' });
    expect(v.ogrenciler.satirlar[0].cells).toEqual(['2024001', 3]);
  });

  it('olay is clamped', () => {
    const n = iz.length;
    expect(deriveKatmanView({ ...base, olay: -5 }).sequence.messages).toHaveLength(0);
    expect(deriveKatmanView({ ...base, olay: 99999 }).sequence.messages).toHaveLength(n);
    expect(deriveKatmanView({ ...base, olay: n + 1.5 }).sequence.messages).toHaveLength(n);
    expect(deriveKatmanView({ ...base, olay: Number.NaN }).sequence.messages).toHaveLength(0);
  });

  it('lab badge is kitap-kodu for a changed start', () => {
    expect(katmanLabRozet(base)).toEqual({ tur: 'kitap' });
    expect(katmanLabRozet({ ...base, kitapKodu: '' })).toEqual({ tur: 'kitap', ref: 'L1297' });
    expect(katmanLabRozet({ ...base, kitapKodu: '', tekrar: 2 }).tur).toBe('kitap-kodu');
    expect(katmanLabRozet({ ...base, kitapKodu: 'TS-201' }).tur).toBe('kitap-kodu');
    expect(katmanLabRozet({ ...base, uygunMu: false }).tur).toBe('kitap-kodu');
    expect(katmanLabRozet({ ...base, mevcutOduncSayisi: 1 }).tur).toBe('kitap-kodu');
    expect(katmanLabRozet({ ...base, ogrenciNumarasi: '' }).tur).toBe('kitap-kodu');
  });
});
