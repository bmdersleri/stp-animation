import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/rate-limiting/code-text';
import { loginOynat } from '../../../src/concepts/rate-limiting/desenler';
import { DAL_SATIRI, loginIsteginiIsle, yeniLimiter } from '../../../src/concepts/rate-limiting/limiter';
import { ELLE_SINIRI, rateScenario as sc, TUMU, type RateParams } from '../../../src/concepts/rate-limiting/scenario';
import { deriveRateView, rateLabRozet } from '../../../src/concepts/rate-limiting/view';
import { lineOf, listing } from '../../../src/core/listing';

const step = (n: number): RateParams => sc.steps[n - 1].params as RateParams;
const view = (n: number, kitapCiktisi = true) => deriveRateView(step(n), kitapCiktisi);
const K5 = listing(LISTINGS, 'kod-11-5');
const K7 = listing(LISTINGS, 'kod-11-7');
const K5_CIKTI = listing(LISTINGS, 'kod-11-5-cikti').lines;
const K7_CIKTI = K7.lines.filter((s) => s.startsWith('// Çıktı: ')).map((s) => s.replace('// Çıktı: ', ''));
const metinler = (v: { terminal: readonly { metin: string }[] }) => v.terminal.map((t) => t.metin);

describe('rate-limiting view', () => {
  it('step 4 two orange dots stacked at t=0', () => {
    const v = view(4);
    expect(v.timeline.noktalar).toHaveLength(5);
    const red = v.timeline.noktalar.filter((n) => !n.izin);
    expect(red.map((n) => [n.t, n.yigin])).toEqual([[0, 3], [0, 4]]);
    expect(v.timeline.noktalar.map((n) => n.yigin)).toEqual([0, 1, 2, 3, 4]);
    expect(v.timeline.noktalar.map((n) => n.etkin)).toEqual([false, false, false, false, true]);
    expect(v.tablo.satirlar[0].cells).toEqual(['203.0.113.10', 3, 't = 0 s']);
    expect(v.code.active).toEqual([DAL_SATIRI.sinirda]);
  });

  it('step 7 two window bands', () => {
    const v = view(7);
    expect(v.timeline.bantlar).toEqual([
      { ip: '203.0.113.10', bas: 0, son: 60_000 },
      { ip: '203.0.113.10', bas: 60_000, son: 120_000 },
    ]);
    expect(v.timeline.xMax).toBe(121_000);
  });

  it('step 8 counter stays at 1 after CORS failure', () => {
    const v = view(8);
    expect(v.timeline.noktalar).toHaveLength(2);
    // The CORS-refused call never reached the limiter: its dot is not allowed and adds no counter.
    expect(v.timeline.noktalar.map((n) => n.izin)).toEqual([true, false]);
    expect(v.tablo.satirlar).toHaveLength(1);
    expect(v.tablo.satirlar[0].cells).toEqual(['203.0.113.20', 1, 't = 0 s']);
    expect(v.tablo.satirlar[0].changed ?? []).toEqual([]);
    expect(v.denetim!.denetimler.map((d) => d.durum)).toEqual(['kaldi', 'atlandi', 'atlandi', 'atlandi', 'atlandi']);
    expect(v.code.title).toBe(K7.title);
    expect(v.code.active).toEqual([lineOf(K7, 'if (!izinVerilenKokenler.includes(kaynakKoken))')]);
  });

  it('step 9 last response 429', () => {
    const v = view(9);
    expect(v.terminal).toHaveLength(5);
    expect(v.terminal[4].metin).toContain('durumKodu: 429');
    expect(v.terminal[4].metin).toContain('Çok fazla giriş denemesi');
    // the dot of a call the limiter refused is not allowed
    expect(v.timeline.noktalar[4]).toMatchObject({ izin: false, etkin: true });
    expect(v.denetim!.denetimler.map((d) => d.durum)).toEqual(['gecti', 'kaldi', 'atlandi', 'atlandi', 'atlandi']);
    expect(v.code.active).toEqual([lineOf(K7, 'if (!loginLimiter.istegeIzinVer(istemciIp))')]);
  });

  it('code strip line follows branch', () => {
    expect(view(2).code.active).toEqual([DAL_SATIRI['yeni-pencere']]);
    expect(view(3).code.active).toEqual([DAL_SATIRI.artir]);
    expect(view(4).code.active).toEqual([DAL_SATIRI.sinirda]);
    expect(view(4).code.title).toBe(K5.title);
    expect(new Set(Object.values(DAL_SATIRI)).size).toBe(3);
  });

  it('istek is clamped to request count', () => {
    expect(deriveRateView({ ...step(4), istek: 0 }).timeline.noktalar).toHaveLength(1);
    expect(deriveRateView({ ...step(4), istek: 500 }).timeline.noktalar).toHaveLength(5);
    expect(deriveRateView({ ...step(4), istek: TUMU }).timeline.noktalar).toHaveLength(5);
  });

  it('elle pattern is capped at ELLE_SINIRI', () => {
    const elle = Array.from({ length: 45 }, (_, i) => ({ t: i * 100, ip: '10.0.0.1' }));
    expect(deriveRateView({ ...step(4), desen: 'elle', elle }).timeline.noktalar).toHaveLength(ELLE_SINIRI);
    expect(deriveRateView({ ...step(4), desen: 'elle', elle: [] }).timeline.noktalar).toEqual([]);
  });

  it('changing maksimumIstek recomputes from scratch', () => {
    const v = deriveRateView({ ...step(4), maksimumIstek: 5 });
    expect(v.timeline.noktalar.every((n) => n.izin)).toBe(true);
    expect(v.tablo.satirlar[0].cells[1]).toBe(5);
    expect(deriveRateView({ ...step(4), maksimumIstek: 1 }).timeline.noktalar.filter((n) => n.izin)).toHaveLength(1);
    // login keeps its fixed 3 / 60 s
    expect(deriveRateView({ ...step(9), maksimumIstek: 1, pencereSn: 10 })).toEqual(deriveRateView(step(9)));
  });

  it('changed cell marks the counter on an accepted request', () => {
    expect(view(3).tablo.satirlar[0]).toMatchObject({ cells: ['203.0.113.10', 3, 't = 0 s'], changed: [1] });
    expect(view(2).tablo.satirlar[0].state).toBe('yeni');
  });

  it('book terminal lines only with kitapCiktisi', () => {
    // the book's call: its printed lines; computed lines come out in the same format
    expect(metinler(deriveRateView(step(4), true))).toEqual(K5_CIKTI);
    expect(metinler(deriveRateView(step(4), false))).toEqual(K5_CIKTI);
    // not the book's call: always the page's own computed lines
    const iki = ['Deneme 1: kabul edildi', 'Deneme 2: kabul edildi', 'Deneme 3: 429 Too Many Requests', 'Deneme 4: 429 Too Many Requests', 'Deneme 5: 429 Too Many Requests'];
    expect(metinler(deriveRateView({ ...step(4), maksimumIstek: 2 }, true))).toEqual(iki);
    expect(metinler(deriveRateView({ ...step(4), pencereSn: 30 }, true))).toEqual(K5_CIKTI);
    // login: Kod 11.7's L1207-1208 only with the flag
    expect(metinler(view(8, true))).toEqual(K7_CIKTI);
    const hesap = metinler(view(8, false));
    expect(hesap).toHaveLength(2);
    expect(hesap).toEqual(K7_CIKTI);
    expect(metinler(deriveRateView({ ...step(9), istek: 5 }, true)).slice(0, 2)).toEqual(K7_CIKTI);
    expect(metinler(deriveRateView({ ...step(9), istek: 5 }, true))).toHaveLength(5);
  });

  it('login code line comes from the model, per result', () => {
    const basari = lineOf(K7, 'Giriş başarılı.');
    expect(loginOynat().sonuclar.map((s) => s.satir)).toEqual([basari, lineOf(K7, 'if (!izinVerilenKokenler.includes(kaynakKoken))'), basari, basari, lineOf(K7, 'if (!loginLimiter.istegeIzinVer(istemciIp))')]);
    expect(deriveRateView({ ...step(9), istek: 3 }).code.active).toEqual([basari]);
    // no pattern sends a body without parola; call the model directly: the 400 points at the parola line
    const c = { koken: 'https://kutuphane.mehmetakif.edu.tr', ip: '203.0.113.20', govde: { kullaniciAdi: 'elif' }, simdi: 0 };
    const r = loginIsteginiIsle(yeniLimiter(3, 60_000), c, { JWT_SECRET: 'x' });
    expect(r.sonuc.yanit.durumKodu).toBe(400);
    expect(r.sonuc.satir).toBe(lineOf(K7, 'parola zorunludur.'));
    expect(r.sonuc.satir).not.toBe(lineOf(K7, 'İstek gövdesi bir nesne olmalıdır.'));
  });

  it('kitapCiktisi true still shows computed lines when the call is not the one in the book', () => {
    const v = deriveRateView({ ...step(4), maksimumIstek: 2 }, true);
    expect(metinler(v)).not.toEqual(K5_CIKTI);
    expect(metinler(v)[2]).toBe('Deneme 3: 429 Too Many Requests');
    expect(metinler(v)[1]).toBe('Deneme 2: kabul edildi');
    // login with a changed call count: lines past the book's two are computed
    expect(metinler(deriveRateView({ ...step(9), istek: 5 }, true)).slice(2)).toEqual(metinler(deriveRateView({ ...step(9), istek: 5 }, false)).slice(2));
  });

  it('intro and summary views show no computed value', () => {
    expect(deriveRateView(sc.steps[9].params as RateParams, true).ozet).toBe(true);
    expect(deriveRateView(step(1), true).ozet).toBe(false);
  });

  it('lab badge is always book code', () => {
    expect(rateLabRozet(step(4))).toEqual({ tur: 'kitap-kodu' });
    expect(rateLabRozet({ ...step(4), desen: 'login' })).toEqual({ tur: 'kitap-kodu' });
  });

  it('a CORS-refused login call has durum 403 and a limiter refusal has 429', () => {
    const l = deriveRateView({ ...step(4), desen: 'login', istek: 5 }).timeline.noktalar;
    expect(l.map((n) => n.durum)).toEqual(['kabul', '403', 'kabul', 'kabul', '429']);
    expect(l[1].izin).toBe(false);
    expect(deriveRateView(step(4)).timeline.noktalar.map((n) => n.durum)).toEqual(['kabul', 'kabul', 'kabul', '429', '429']);
  });
});
