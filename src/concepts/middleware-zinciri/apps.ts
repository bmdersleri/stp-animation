import { lineOf, listing } from '../../core/listing';
import { HATA_ORNEGI, LISTINGS } from './code-text';
import type { Fn, Katman } from './express-sim';

export const ANAHTAR = 'kitap-api-2026';

export interface LabSecenek {
  gunlukNext: boolean;
  kontrolGenel: boolean;
  hataKatmani: boolean;
}

const KOD55 = listing(LISTINGS, 'kod-5-5');
const CODE010 = listing(LISTINGS, 'code-010');
const CODE017 = listing(LISTINGS, 'code-017');

/** Kod 5.5 layers, then GET /hata-ornegi and (if hataKatmani) the error layer. */
export function kod55(s: LabSecenek): Katman[] {
  const json: Fn = {
    ad: 'json',
    arity: 3,
    satir: lineOf(KOD55, 'uygulama.use(express.json())'),
    govde: (c) => c.next(),
  };
  const gunlukSatir = lineOf(KOD55, 'function istekGunlugu');
  const gunluk: Fn = {
    ad: 'gunluk',
    arity: 3,
    satir: gunlukSatir,
    govde: (c) => {
      c.at(lineOf(KOD55, 'console.log(`${istek.method}', gunlukSatir));
      c.log(`${c.istek.metot} ${c.istek.yol}`);
      if (s.gunlukNext) {
        c.at(lineOf(KOD55, 'sonrakiAdim();', gunlukSatir));
        c.next();
      }
    },
  };
  const anahtarSatir = lineOf(KOD55, 'function apiAnahtariKontrolu');
  const anahtar: Fn = {
    ad: 'anahtar',
    arity: 3,
    satir: anahtarSatir,
    govde: (c) => {
      c.at(lineOf(KOD55, 'if (apiAnahtari !==', anahtarSatir));
      if (c.istek.basliklar['x-api-anahtari'] !== ANAHTAR) {
        c.at(lineOf(KOD55, 'yanit.status(401)', anahtarSatir));
        c.yanit.status(401).json({ mesaj: 'Yetkisiz istek.' });
        return;
      }
      c.at(lineOf(KOD55, 'sonrakiAdim();', anahtarSatir));
      c.next();
    },
  };
  const isleyici: Fn = {
    ad: 'isleyici',
    arity: 3,
    satir: lineOf(KOD55, '(istek: Request, yanit: Response) => {'),
    govde: (c) => {
      c.at(lineOf(KOD55, 'yanit.json({ mesaj: "Korumalı'));
      c.yanit.json({ mesaj: 'Korumalı bilgiye erişildi.' });
    },
  };
  const hataRoute: Fn = {
    ad: 'hataRoute',
    arity: 3,
    satir: lineOf(HATA_ORNEGI, 'uygulama.get("/hata-ornegi"'),
    govde: (c) => {
      c.at(lineOf(HATA_ORNEGI, 'throw new Error'));
      throw new Error('Beklenmeyen durum');
    },
  };
  const hataMw: Fn = {
    ad: 'hataMw',
    arity: 4,
    satir: lineOf(HATA_ORNEGI, 'uygulama.use((hata: Error'),
    govde: (c) => {
      c.at(lineOf(HATA_ORNEGI, 'console.error'));
      c.error(c.hata?.message ?? '');
      c.at(lineOf(HATA_ORNEGI, 'yanit.status(500)'));
      c.yanit.status(500).json({ mesaj: 'Sunucuda beklenmeyen bir hata oluştu.' });
    },
  };

  const app: Katman[] = [
    { tur: 'use', fn: json },
    { tur: 'use', fn: gunluk },
  ];
  if (s.kontrolGenel) {
    app.push({ tur: 'use', fn: anahtar }, { tur: 'route', metot: 'GET', yol: '/korumali-durum', fns: [isleyici] });
  } else {
    app.push({ tur: 'route', metot: 'GET', yol: '/korumali-durum', fns: [anahtar, isleyici] });
  }
  app.push({ tur: 'route', metot: 'GET', yol: '/hata-ornegi', fns: [hataRoute] });
  if (s.hataKatmani) app.push({ tur: 'use', fn: hataMw });
  return app;
}

/** code_010: use(hataliGunluk) + GET /kitaplar (the skeleton run as an Express app, ruling R8). */
export function kod010(): Katman[] {
  const gunlukSatir = lineOf(CODE010, 'function hataliGunluk');
  const hataliGunluk: Fn = {
    ad: 'gunluk',
    arity: 3,
    satir: gunlukSatir,
    govde: (c) => {
      c.at(lineOf(CODE010, 'console.log(istek.path)', gunlukSatir));
      c.log(c.istek.yol);
    },
  };
  const isleyici: Fn = {
    ad: 'isleyici',
    arity: 3,
    satir: lineOf(CODE010, 'hataliGunluk(sahteIstek'),
    govde: (c) => c.yanit.json([]),
  };
  return [
    { tur: 'use', fn: hataliGunluk },
    { tur: 'route', metot: 'GET', yol: '/kitaplar', fns: [isleyici] },
  ];
}

/** code_017: GET /kitaplar/99 whose handler sends 404 and then calls json again. */
export function kod017(): Katman[] {
  const isleyici: Fn = {
    ad: 'isleyici',
    arity: 3,
    satir: lineOf(CODE017, 'if (!bulunanKitap)'),
    govde: (c) => {
      c.at(lineOf(CODE017, 'yanit.status(404)'));
      c.yanit.status(404).json({ mesaj: 'Kitap bulunamadı.' });
      c.at(lineOf(CODE017, 'yanit.json(bulunanKitap)'));
      c.yanit.json(undefined);
    },
  };
  return [{ tur: 'route', metot: 'GET', yol: '/kitaplar/99', fns: [isleyici] }];
}
