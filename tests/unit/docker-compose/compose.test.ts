import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/docker-compose/code-text';
import {
  KITAP_SAGLIK, KOMPOZ_SECENEKLERI, composeUp, hazirMiFn, saglikDegerlendir,
  saglikliBaglantiKur, saniyeEtiketi, type ComposeSenaryo,
} from '../../../src/concepts/docker-compose/compose';

const sen = (o: Partial<ComposeSenaryo>): ComposeSenaryo => ({
  mod: 'sira', dbHazirMs: 4000, retries: 10, maksimumDeneme: 5, hostAdi: 'kutuphane-db', ...o,
});
const ts = (r: ReturnType<typeof composeUp>) => r.baglanti!.denemeler.map((d) => d.t);
const ok = (r: ReturnType<typeof composeUp>) => r.baglanti!.denemeler.map((d) => d.basari);

describe('docker-compose model', () => {
  it('book output L990', () => {
    const r = composeUp(sen({ dbHazirMs: 1000 }));
    expect(ts(r)).toEqual([0, 500, 1000]);
    expect(ok(r)).toEqual([false, false, true]);
    expect(r.baglanti!.log).toEqual(LISTINGS.find((l) => l.id === 'kod-14-9-cikti')!.lines);
    expect(r.durum).toBe('kuruldu');
  });

  it("book's counting fake gives the same line", () => {
    let sayac = 0;
    const r = saglikliBaglantiKur(KOMPOZ_SECENEKLERI, () => ++sayac >= 3, 0);
    expect(r.log).toEqual(['[kutuphane-db] Bağlantı 3. denemede kuruldu.']);
    expect(r.durum).toBe('kuruldu');
  });

  it('saglikli 4000', () => {
    const r = composeUp(sen({ mod: 'saglikli' }));
    expect(r.saglik!.problar).toEqual([
      { k: 1, t: 2000, durum: 'kaldi', ardisikHata: 1 },
      { k: 2, t: 4000, durum: 'gecti', ardisikHata: 0 },
    ]);
    expect(r.saglik!.saglikliMs).toBe(4000);
    expect(r.apiBaslangicMs).toBe(4000);
    expect(r.baglanti!.log).toEqual(['[kutuphane-db] Bağlantı 1. denemede kuruldu.']);
  });

  it('sira 4000 five tries fail', () => {
    const r = composeUp(sen({}));
    expect(ts(r)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(ok(r)).toEqual([false, false, false, false, false]);
    expect(r.baglanti!.hata).toBe('5 denemede veritabanına bağlanılamadı: kutuphane-db');
    expect(r.durum).toBe('hata');
    expect(r.olaylar[r.olaylar.length - 1].id).toBe('deneme-5-ret');
  });

  it('sira 4000 ten tries', () => {
    const r = composeUp(sen({ maksimumDeneme: 10 }));
    expect(r.baglanti!.denemeler[8]).toEqual({ deneme: 9, t: 4000, basari: true });
  });

  it('sira 1500 five tries', () => {
    const r = composeUp(sen({ dbHazirMs: 1500 }));
    expect(r.baglanti!.denemeler[3]).toEqual({ deneme: 4, t: 1500, basari: true });
  });

  it('probe at exactly dbHazirMs passes', () => {
    const a = saglikDegerlendir(0, KITAP_SAGLIK);
    expect(a.problar[0]).toMatchObject({ t: 2000, durum: 'gecti' });
    expect(a.saglikliMs).toBe(2000);
    const b = saglikDegerlendir(20000, KITAP_SAGLIK);
    expect(b.problar).toHaveLength(10);
    expect(b.problar[9]).toMatchObject({ k: 10, t: 20000, durum: 'gecti' });
    expect(b.saglikliMs).toBe(20000);
  });

  it('unhealthy after ten failures', () => {
    for (const db of [20500, 30000]) {
      const r = composeUp(sen({ mod: 'saglikli', dbHazirMs: db }));
      expect(r.saglik!.problar.map((p) => p.t)).toEqual([2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000]);
      expect(r.saglik!.problar.every((p) => p.durum === 'kaldi')).toBe(true);
      expect(r.saglik!.unhealthyMs).toBe(20000);
      expect(r.saglik!.saglikliMs).toBeNull();
      expect(r.apiBaslangicMs).toBeNull();
      expect(r.durum).toBe('bagimlilik-basarisiz');
      expect(r.baglanti).toBeUndefined();
    }
    expect(composeUp(sen({ mod: 'saglikli', dbHazirMs: 30000, retries: 3 })).saglik!.unhealthyMs).toBe(6000);
  });

  it('start period probes are not counted', () => {
    const r = saglikDegerlendir(30000, { ...KITAP_SAGLIK, startPeriod: 10000 });
    expect(r.problar.filter((p) => p.durum === 'sayilmadi').map((p) => p.t)).toEqual([2000, 4000, 6000, 8000]);
    const kaldi = r.problar.filter((p) => p.durum === 'kaldi').map((p) => p.t);
    expect(kaldi).toEqual([10000, 12000, 14000, 16000, 18000, 20000, 22000, 24000, 26000, 28000]);
    expect(r.unhealthyMs).toBe(28000);
  });

  it('localhost never connects', () => {
    const r = composeUp(sen({ mod: 'saglikli', hostAdi: 'localhost' }));
    expect(r.apiBaslangicMs).toBe(4000);
    expect(ts(r)).toEqual([4000, 4500, 5000, 5500, 6000]);
    expect(ok(r).some(Boolean)).toBe(false);
    expect(r.baglanti!.hata).toBe('5 denemede veritabanına bağlanılamadı: localhost');
    const d1 = r.olaylar.find((m) => m.id === 'deneme-1')!;
    expect(d1).toMatchObject({ from: 'api', to: 'api', kind: 'note', label: 'localhost:5432 · ECONNREFUSED', tone: 'alarm' });
    expect(r.olaylar.some((m) => m.id === 'deneme-1-ret')).toBe(false);
  });

  it('single try has no wait', () => {
    const r = composeUp(sen({ maksimumDeneme: 1 }));
    expect(ts(r)).toEqual([0]);
    expect(ok(r)).toEqual([false]);
    expect(r.olaylar.find((m) => m.id === 'deneme-1-ret')!.label).toBe('ECONNREFUSED');
    expect(r.olaylar.some((m) => m.label.includes('127.0.0.1'))).toBe(false);
  });

  it('events are in time order with stable ids', () => {
    const r = composeUp(sen({ mod: 'saglikli', dbHazirMs: 4000 }));
    expect(r.olaylar.map((m) => m.id)).toEqual([
      'baslat-db', 'prob-1', 'prob-2', 'saglik', 'baslat-api', 'deneme-1',
    ]);
    expect(r.olaylar.find((m) => m.id === 'saglik')).toMatchObject({ from: 'db', to: 'db', kind: 'note', label: 'healthy · t = 4 s' });
    expect(r.olaylar.find((m) => m.id === 'prob-1')).toMatchObject({ from: 'compose', to: 'db', kind: 'request', label: 'pg_isready · t = 2 s', tone: 'alarm' });
    expect(r.olaylar.find((m) => m.id === 'prob-2')!.tone).toBe('ok');
    const s = composeUp(sen({ dbHazirMs: 1000 }));
    expect(s.olaylar.map((m) => m.id)).toEqual([
      'baslat-db', 'baslat-api', 'deneme-1', 'deneme-1-ret', 'deneme-2', 'deneme-2-ret', 'deneme-3',
    ]);
    expect(s.olaylar[0]).toMatchObject({ from: 'compose', to: 'db', kind: 'request', label: 'başlat · t = 0 s' });
    expect(s.olaylar[2]).toMatchObject({ from: 'api', to: 'db', label: 'bağlan · t = 0 s', tone: 'alarm' });
    expect(s.olaylar[3]).toMatchObject({ from: 'db', to: 'api', kind: 'response', label: 'ECONNREFUSED', tone: 'alarm' });
    expect(s.olaylar[6].tone).toBe('ok');
    const u = composeUp(sen({ mod: 'saglikli', dbHazirMs: 30000 }));
    expect(u.olaylar[u.olaylar.length - 1]).toMatchObject({ id: 'saglik', label: 'unhealthy · t = 20 s' });
  });

  it('hazirMiFn', () => {
    expect(hazirMiFn('kutuphane-db', 1000)(999)).toBe(false);
    expect(hazirMiFn('kutuphane-db', 1000)(1000)).toBe(true);
    expect(hazirMiFn('localhost', 0)(99999)).toBe(false);
  });

  it('saniyeEtiketi formats with a comma', () => {
    expect(saniyeEtiketi(0)).toBe('t = 0 s');
    expect(saniyeEtiketi(1500)).toBe('t = 1,5 s');
    expect(saniyeEtiketi(4000)).toBe('t = 4 s');
    expect(saniyeEtiketi(20000)).toBe('t = 20 s');
  });

  it('listings match book', () => {
    expect(LISTINGS).toHaveLength(11);
    for (const l of LISTINGS) expect(l.lines.length).toBe(l.satirlar[1] - l.satirlar[0] + 1);
    const k = LISTINGS.find((l) => l.id === 'kod-14-9')!;
    expect(k.lines).toHaveLength(54);
    expect(k.lines[0]).toBe('// File: ChapterMiniAppDockerCompose.ts');
    expect(k.lines[53]).toBe('// Çıktı: [kutuphane-db] Bağlantı 3. denemede kuruldu.');
    expect(LISTINGS.find((l) => l.id === 'code-012-cikti')!.lines).toEqual([
      '// Beklenmeyen çıktı: Error: connect ECONNREFUSED 127.0.0.1:5432',
    ]);
    expect(LISTINGS.find((l) => l.id === 'kod-14-4-cikti')!.lines).toEqual([
      '# Çıktı: kutuphane-api-1   0.0.0.0:3000->3000/tcp',
      '# Çıktı: kutuphane-api-2   0.0.0.0:3001->3000/tcp',
    ]);
  });
});
