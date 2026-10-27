import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/rbac-401-403/code-text';
import { rbacScenario as sc, type RbacParams } from '../../../src/concepts/rbac-401-403/scenario';
import { deriveRbacView, rbacLabRozet } from '../../../src/concepts/rbac-401-403/view';
import { lineOf, listing } from '../../../src/core/listing';

const step = (n: number): RbacParams => sc.steps[n - 1].params as RbacParams;
const view = (n: number, kitapCiktisi = true) => deriveRbacView(step(n), kitapCiktisi);
const K7 = listing(LISTINGS, 'kod-10-7');
const kitapCikti = K7.lines.filter((s) => s.startsWith('// Çıktı: ')).map((s) => s.replace('// Çıktı: ', ''));
/** nodeInspect of the three Kod 10.7 results, single-line. */
const BIR_SATIR = ["{ durumKodu: 201, mesaj: 'Kitap eklendi.' }", "{ durumKodu: 403, mesaj: '403: Bu işlem için yetkiniz yok.' }", "{ durumKodu: 401, mesaj: '401' }"];

describe('rbac-401-403 view', () => {
  it('step 5 role check kaldi and 403', () => {
    const v = view(5);
    expect(v.denetim!.denetimler.map((d) => d.durum)).toEqual(['gecti', 'kaldi']);
    expect(v.http.yanitlar[0].durumKodu).toBe(403);
    expect(v.sequence!.stopTone).toBe('alarm');
  });

  it('step 6 rol lane dimmed', () => {
    const v = view(6);
    expect(v.sequence!.dim).toEqual(['sadeceKutuphaneci']);
    expect(v.denetim!.denetimler.map((d) => d.durum)).toEqual(['kaldi', 'atlandi']);
    expect(v.http.yanitlar[0].durumKodu).toBe(401);
  });

  it('step 7 no kitapEkle call and tokenNotu set', () => {
    const v = view(7);
    expect(v.tokenNotu).toBe('token yok: girisYap 401 fırlattı');
    expect(v.denetim).toBeNull();
    expect(v.sequence!.messages.some((m) => m.label.startsWith('kitapEkle'))).toBe(false);
    expect(v.http.yanitlar).toEqual([{ durumKodu: 401, durumMetni: 'Unauthorized', govde: '401: Kullanıcı adı veya parola hatalı.' }]);
  });

  it('step 8 first request card has no Authorization header', () => {
    const v = view(8);
    expect(v.http.istek!.basliklar).toBeUndefined();
    expect(v.istekler[1].basliklar).toEqual([['Authorization', 'Bearer gecerli-token']]);
    expect(v.http.yanitlar[0].govde).toBe('{"mesaj":"Token bulunamadı."}');
  });

  it('step 9 terminal equals L912-917', () => {
    const v = view(9);
    expect(v.http.terminal.map((t) => t.metin)).toEqual(listing(LISTINGS, 'kod-10-6-cikti').lines);
    expect(v.http.terminal.map((t) => t.metin).join('\n')).toBe(v.http.yanitlar.map((y) => y.govde).join('\n'));
  });

  it('steps 4-6 accumulate the book output L1254-1256 only with kitapCiktisi', () => {
    expect(kitapCikti).toEqual(BIR_SATIR);
    [4, 5, 6].forEach((n, i) => expect(view(n).http.terminal.map((t) => t.metin), `step ${n}`).toEqual(kitapCikti.slice(0, i + 1)));
  });

  it('lab state with book params prints only its own call', () => {
    [4, 5, 6].forEach((n) => expect(view(n, false).http.terminal.map((t) => t.metin), `step ${n}`).toEqual([BIR_SATIR[n - 4]]));
  });

  it('step 2 table has two rows without plain passwords', () => {
    const t = view(2).tablo!;
    expect(t.satirlar).toHaveLength(2);
    expect(t.sutunlar.map((s) => s.ad)).toEqual(['kullaniciAdi', 'salt', 'parolaHash', 'rol']);
    for (const s of t.satirlar) {
      expect(s.state).toBe('yeni');
      expect(String(s.cells[2])).toMatch(/^[0-9a-f]{16}…$/);
      for (const c of s.cells) expect(String(c)).not.toContain('Parola1');
    }
  });

  it('step 3 shows two cut tokens and the roles in the note', () => {
    const v = view(3);
    expect(v.http.terminal.map((t) => t.metin)).toEqual(['yasemin: eyJhbGci…', 'elif: eyJhbGci…']);
    expect(v.tokenNotu).toContain('yasemin: rol kutuphaneci');
    expect(v.tokenNotu).toContain('elif: rol ogrenci');
  });

  it('lab ahmet gives 401 same message as wrong password', () => {
    const ahmet = deriveRbacView({ ...step(4), kullanici: 'ahmet' });
    const yanlis = deriveRbacView(step(7));
    expect(ahmet.http.yanitlar[0].govde).toBe('401: Kullanıcı adı veya parola hatalı.');
    expect(ahmet.http.yanitlar).toEqual(yanlis.http.yanitlar);
    expect(ahmet.tokenNotu).toBe('token yok: girisYap 401 fırlattı');
    expect(deriveRbacView({ ...step(4), kullanici: 'ahmet', parola: 'yanlis' }).http.yanitlar).toEqual(yanlis.http.yanitlar);
  });

  it('lab dakika 16 gives 401 at L1175', () => {
    const sure = lineOf(K7, 'Date.now() > payload.sonGecerlilik');
    const v = deriveRbacView({ ...step(4), dakika: 16 });
    expect(v.http.yanitlar[0].durumKodu).toBe(401);
    expect(v.denetim!.denetimler[0].ayrinti).toBe(`L${1117 + sure}: süre doldu`);
    expect(v.code.active).toEqual([sure]);
    expect(deriveRbacView({ ...step(4), dakika: 15 }).http.yanitlar[0].durumKodu).toBe(201);
  });

  it('code strip line follows decision', () => {
    const at = (fragment: string) => [lineOf(K7, fragment)];
    expect(view(4).code.active).toEqual(at('return { durumKodu: 201'));
    expect(view(5).code.active).toEqual(at('if (!izinVerilenRoller.includes'));
    expect(view(6).code.active).toEqual(at('if (imza !== imzaOlustur'));
    expect(view(7).code.active).toEqual(at('if (!kayit || !parolaDogrula'));
    expect(deriveRbacView({ ...step(5), roller: 'ikisi' }).code.active).toEqual(at('return { durumKodu: 201'));
  });

  it('step 10 shows the wrong 401 with the note', () => {
    const v = view(10);
    expect(v.http.yanitlar[0].durumKodu).toBe(401);
    expect(v.tokenNotu).toBe('Doğrusu 403');
  });

  it('step 11 is the summary table', () => {
    const v = view(11);
    expect(v.ozet).toBe(true);
    expect(v.tablo!.satirlar).toHaveLength(4);
  });

  it('every lab combination yields a view', () => {
    let n = 0;
    for (const kullanici of ['yasemin', 'elif', 'ahmet'] as const)
      for (const parola of ['dogru', 'yanlis'] as const)
        for (const token of ['giris', 'gecersiz', 'yok'] as const)
          for (const dakika of [0, 16])
            for (const roller of ['kutuphaneci', 'ikisi'] as const) {
              const v = deriveRbacView({ program: 'kod-10-7', asama: 'kitap-ekle', kullanici, parola, token, dakika, roller });
              expect(v.code.active.length).toBe(1);
              expect(v.http.yanitlar.length).toBe(1);
              n++;
            }
    expect(n).toBe(72);
  });

  it('lab badge is always kitap-kodu', () => {
    expect(rbacLabRozet(step(4)).tur).toBe('kitap-kodu');
  });
});
