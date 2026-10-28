import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/docker-compose/code-text';
import { composeScenario as sc, type ComposeParams } from '../../../src/concepts/docker-compose/scenario';
import { composeLabRozet, deriveComposeView, problariKisalt } from '../../../src/concepts/docker-compose/view';
import { listing } from '../../../src/core/listing';

const step = (n: number): ComposeParams => sc.steps[n - 1].params as ComposeParams;
const view = (n: number, kitapCiktisi = true) => deriveComposeView(step(n), kitapCiktisi);
const metinler = (v: { terminal: readonly { metin: string }[] }) => v.terminal.map((t) => t.metin);
/** Book line L of a listing, looked up by the test itself so it reads the text, not a number. */
const satir = (id: string, L: number) => { const l = listing(LISTINGS, id); return l.lines[L - l.satirlar[0]]; };
const tumMetin = (v: ReturnType<typeof deriveComposeView>) => JSON.stringify([v.sequence, v.tablo, v.problar, v.terminal, v.notlar]);

describe('docker-compose view', () => {
  it('step 7 terminal is book L886', () => {
    const v = view(7);
    expect(v.terminal).toEqual([{ metin: 'Error: connect ECONNREFUSED 127.0.0.1:5432', akis: 'stderr' }]);
    expect(v.tablo!.satirlar[0].cells).toEqual(['localhost', 'Hata 1: host adı olarak "localhost" kullanılıyor; ama API kendi container\x27ında çalıştığı için "localhost" kendi container\x27ını işaret eder, veritabanı container\x27ını değil.']);
  });

  it('step 8 api started at t = 0 s and db starting', () => {
    const v = view(8);
    expect(v.tablo!.baslik).toBe('Servisler');
    expect(v.tablo!.satirlar.map((r) => r.cells)).toEqual([
      ['kutuphane-db', 'starting', 't = 0 s'],
      ['kutuphane-api', 'başladı', 't = 0 s'],
    ]);
    expect(v.problar).toBeNull();
    expect(v.sequence!.messages.filter((m) => m.label === 'ECONNREFUSED')).toHaveLength(1);
    expect(v.terminal[0].akis).toBe('stderr');
  });

  it('step 9 two probes kaldi then gecti, api at t = 4 s', () => {
    const v = view(9);
    expect(v.problar!.baslik).toBe('Sağlık probları');
    expect(v.problar!.denetimler.map((d) => d.durum)).toEqual(['kaldi', 'gecti']);
    expect(v.problar!.denetimler.map((d) => d.ad)).toEqual(['pg_isready · t = 2 s', 'pg_isready · t = 4 s']);
    expect(v.problar!.denetimler.map((d) => d.ayrinti)).toEqual(['hazır değil, 1/10', 'healthy']);
    expect(v.tablo!.satirlar.map((r) => r.cells)).toEqual([
      ['kutuphane-db', 'healthy', 't = 4 s'],
      ['kutuphane-api', 'başladı', 't = 4 s'],
    ]);
    expect(metinler(v)).toEqual(['[kutuphane-db] Bağlantı 1. denemede kuruldu.']);
  });

  it('step 10 terminal is book L990', () => {
    const v = view(10);
    expect(metinler(v)).toEqual([listing(LISTINGS, 'kod-14-9-cikti').lines[0]]);
    expect(metinler(view(10, false))).toEqual(metinler(v));
    expect(v.terminal[0].akis).toBeUndefined();
    expect(v.problar).toBeNull();
  });

  it('step 2 shows the L351 image/container definition its badge cites', () => {
    expect(view(2).notlar).toEqual([
      "Tanım. Image, bir uygulamanın çalışması için gereken dosya sistemi katmanlarının salt okunur bir anlık görüntüsüdür. Container ise bu image'dan başlatılan, kendi izole süreç alanına, dosya sistemine ve ağ arayüzüne sahip çalışan örnektir.",
    ]);
  });

  it("step 3 table cells are the book's comment lines", () => {
    const t = view(3).tablo!;
    const yorum = (...L: number[]) => L.map((n) => satir('kod-14-3', n).replace('# ', '')).join('; ');
    expect(t.baslik).toBe('Kod 14.3 aşamaları');
    expect(t.satirlar.map((r) => r.cells)).toEqual([
      ['1. Aşama: Derleme (Builder) · derleyici', yorum(302, 305, 309)],
      ['2. Aşama: Çalışma Zamanı (Production Runner) · uretim', yorum(322, 327)],
    ]);
    expect(t.satirlar[0].cells[1]).toBe("Tüm bağımlılıkları kur (devDependencies dahil); Kaynak kodları kopyala ve JavaScript'e derle; Yalnızca üretim bağımlılıklarını tut");
  });

  it('unhealthy hides the attempt list and writes the P11 line', () => {
    const v = deriveComposeView({ ...step(9), dbHazirMs: 30_000 });
    expect(v.sequence!.messages.some((m) => m.id.startsWith('deneme'))).toBe(false);
    expect(metinler(v)).toEqual(['kutuphane-db unhealthy: service_healthy koşulu sağlanmadı, kutuphane-api başlatılmadı.']);
    expect(v.tablo!.satirlar.map((r) => r.cells)).toEqual([
      ['kutuphane-db', 'unhealthy', 't = 20 s'],
      ['kutuphane-api', 'başlamadı', '—'],
    ]);
    expect(v.code.title).toBe(listing(LISTINGS, 'code-014').title);
    expect(v.code.active).toEqual([6]);
  });

  it('probe list merges runs longer than five', () => {
    const v = deriveComposeView({ ...step(9), dbHazirMs: 30_000 });
    const d = v.problar!.denetimler;
    expect(d).toHaveLength(5);
    expect(d.map((x) => x.ad)).toEqual(['pg_isready · t = 2 s', 'pg_isready · t = 4 s', '3.–8. prob', 'pg_isready · t = 18 s', 'pg_isready · t = 20 s']);
    expect(d[2]).toMatchObject({ durum: 'kaldi', ayrinti: 'hazır değil, 3/10 … 8/10' });
    expect(d.map((x) => x.durum)).toEqual(['kaldi', 'kaldi', 'kaldi', 'kaldi', 'kaldi']);
    // a run that passes on the tenth probe merges too and ends on the passing probe
    const g = deriveComposeView({ ...step(9), dbHazirMs: 20_000 }).problar!.denetimler;
    expect(g).toHaveLength(5);
    expect(g[4]).toMatchObject({ durum: 'gecti', ayrinti: 'healthy' });
    // five or fewer stay as they are
    expect(deriveComposeView({ ...step(9), dbHazirMs: 10_000 }).problar!.denetimler).toHaveLength(5);
    expect(deriveComposeView({ ...step(9), dbHazirMs: 8_000 }).problar!.denetimler).toHaveLength(4);
    expect(problariKisalt([], 10)).toEqual([]);
  });

  it('code strip focus line text', () => {
    const v7 = view(7);
    expect(v7.code.lines[v7.code.active[0] - 1].trim()).toBe('host: "localhost",');
    const v10 = view(10);
    expect(v10.code.title).toBe(listing(LISTINGS, 'kod-14-9').title);
    expect(v10.code.active).toEqual([23, 31]);
    expect(v10.code.lines[22].trim()).toMatch(/^console\.log\(`\[\$\{/);
    expect(v10.code.lines[22]).toBe(satir('kod-14-9', 955));
    // the tanitim and ozet steps show Kod 14.6 with no active line
    for (const n of [1, 11]) expect(view(n).code).toMatchObject({ title: listing(LISTINGS, 'kod-14-6').title, active: [] });
  });

  it('lab code strip is always Kod 14.9 and the Ders strip follows the step', () => {
    const k9 = listing(LISTINGS, 'kod-14-9').title;
    const lab = (o: Partial<ComposeParams>) => deriveComposeView({ ...step(9), ...o }, false).code;
    expect(lab({})).toMatchObject({ title: k9, active: [23, 31] });
    expect(lab({ hostAdi: 'localhost' })).toMatchObject({ title: k9, active: [28] });
    expect(lab({ mod: 'sira' })).toMatchObject({ title: k9 });
    expect(lab({ dbHazirMs: 30_000 })).toMatchObject({ title: listing(LISTINGS, 'code-014').title, active: [6] });
    // Ders, step 10 failing: the error line of Kod 14.9
    const hata = deriveComposeView({ ...step(10), maksimumDeneme: 1 }, true);
    expect(hata.code).toMatchObject({ title: k9, active: [28] });
    expect(hata.code.lines[27]).toBe(satir('kod-14-9', 960));
    expect(hata.terminal[0].akis).toBe('stderr');
    // Ders steps 8 and 9 keep their own listings
    expect(view(8).code.title).toBe(listing(LISTINGS, 'kod-14-6').title);
    expect(view(9).code.title).toBe(listing(LISTINGS, 'code-014').title);
  });

  it('assumption note follows dbHazirMs', () => {
    expect(view(9).notlar[0]).toBe("sayfa varsayımı: veritabanı t = 4 s'de hazır");
    expect(view(10).notlar[0]).toBe("sayfa varsayımı: veritabanı t = 1 s'de hazır");
    expect(view(10).notlar[1]).toMatch(/^Dikkat noktası: docker-compose\.yml'deki depends_on,/);
    expect(deriveComposeView({ ...step(9), dbHazirMs: 1500 }).notlar[0]).toContain('t = 1,5 s');
  });

  it('no IP address on any compose step', () => {
    for (const n of [8, 9, 10]) expect(tumMetin(view(n)), `step ${n}`).not.toMatch(/127\.0\.0\.1|172\./);
    expect(tumMetin(view(6))).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('image, volume and network steps', () => {
    expect(view(2).tablo!.satirlar.map((r) => r.cells)).toEqual([
      ['kutuphane-api-1', '0.0.0.0:3000->3000/tcp'],
      ['kutuphane-api-2', '0.0.0.0:3001->3000/tcp'],
    ]);
    expect(metinler(view(2))).toEqual(['kutuphane-api-1   0.0.0.0:3000->3000/tcp', 'kutuphane-api-2   0.0.0.0:3001->3000/tcp']);
    expect(view(4).tablo!.satirlar.map((r) => [r.cells[0], r.cells[1], r.state])).toEqual([
      ['kutuphane-db-gecici (container)', 'silindi', 'silindi'],
      ['veri (container içinde)', 'silindi', 'silindi'],
    ]);
    expect(view(4).terminal).toEqual([]);
    expect(view(5).tablo!.satirlar.map((r) => [r.cells[0], r.cells[1]])).toEqual([['kutuphane-db (container)', 'silindi'], ['kutuphane-db-verisi (volume)', 'etkin']]);
    expect(view(5).notlar[0]).toContain('docker compose down -v');
    expect(view(6).tablo!.satirlar[0].cells).toEqual(['kutuphane-db', "kutuphane-db container'ı"]);
    expect(view(6).notlar[0]).toMatch(/^Dikkat noktası: Varsayılan bridge network'te/);
  });

  it('tanitim and ozet fill only the book block', () => {
    const t = view(1);
    expect(t.kitap!.tanim).toMatch(/^Docker Compose, birden fazla container'ı/);
    expect(t.kitap!.notlar[0]).toMatch(/^Sınav Notu: Image salt okunur bir taslaktır/);
    const o = view(11).kitap!;
    expect(o.tablolar[0].baslik).toBe('Kavram sorumluluk matrisi');
    expect(o.tablolar[0].sutunlar.map((s) => s.ad)).toEqual(['Kavram', 'Temel Görevi', 'Ne Yapmaz? (Sorumluluk Sınırı)']);
    expect(o.tablolar[0].satirlar).toHaveLength(7);
    expect(o.tablolar[0].not).toBe('tam tablo L69-77');
    for (const v of [t, view(11)]) expect([v.sequence, v.tablo, v.problar, v.terminal]).toEqual([null, null, null, []]);
    for (const n of [2, 8]) expect(view(n).kitap).toBeNull();
  });

  it('lab badge is always the book code', () => {
    expect(composeLabRozet(step(9))).toEqual({ tur: 'kitap-kodu' });
  });
});
