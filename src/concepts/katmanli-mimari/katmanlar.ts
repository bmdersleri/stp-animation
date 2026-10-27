import { lineOf, listing } from '../../core/listing';
import { nodeInspect } from '../../core/node-inspect';
import { LISTINGS } from './code-text';

export interface Kitap {
  kod: string;
  ad: string;
  uygunMu: boolean;
}
export interface Ogrenci {
  numara: string;
  mevcutOduncSayisi: number;
}
export interface Durum {
  kitaplar: readonly Kitap[];
  ogrenciler: readonly Ogrenci[];
}
export interface OduncAlmaIstegiDTO {
  ogrenciNumarasi: string;
  kitapKodu: string;
}
export type KatmanId = 'cagiran' | 'controller' | 'service' | 'kitapRepo' | 'ogrenciRepo';
/** A 'not' event has from === to. */
export interface KatmanOlayi {
  from: KatmanId;
  to: KatmanId;
  tur: 'cagri' | 'donus' | 'firlat' | 'not';
  etiket: string;
  satir: number;
}
export interface KatmanIzi {
  olaylar: KatmanOlayi[];
  yanit: { durumKodu: 201 | 400; mesaj: string };
  durum: Durum;
  /** nodeInspect(yanit) split into lines: what console.log prints. */
  cikti: string[];
}

export const BASLANGIC: Durum = {
  kitaplar: [{ kod: 'JAVA-101', ad: 'Java ile Programlama', uygunMu: true }],
  ogrenciler: [{ numara: '2024001', mevcutOduncSayisi: 0 }],
};

const KOD = listing(LISTINGS, 'kod-9-5');
const sat = (parca: string, from?: number) => lineOf(KOD, parca, from);
const q = (s: string) => JSON.stringify(s);

export function kurulumOlaylari(): KatmanOlayi[] {
  const yeni = (to: KatmanId, parca: string, etiket: string): KatmanOlayi => ({
    from: 'cagiran',
    to,
    tur: 'cagri',
    etiket,
    satir: sat(parca),
  });
  return [
    yeni('kitapRepo', 'const kitapRepository = new KitapRepository()', 'new KitapRepository()'),
    yeni('ogrenciRepo', 'const ogrenciRepository = new OgrenciRepository()', 'new OgrenciRepository()'),
    yeni('service', 'const oduncAlmaService = new OduncAlmaService(', 'new OduncAlmaService(kitapRepository, ogrenciRepository)'),
    yeni('controller', 'const oduncAlmaController = new OduncAlmaController(', 'new OduncAlmaController(oduncAlmaService)'),
  ];
}

export function istekKarsila(durum: Durum, istek: OduncAlmaIstegiDTO): KatmanIzi {
  const olaylar: KatmanOlayi[] = [];
  const ev = (from: KatmanId, to: KatmanId, tur: KatmanOlayi['tur'], etiket: string, satir: number) =>
    olaylar.push({ from, to, tur, etiket, satir });
  const bitir = (yanit: KatmanIzi['yanit'], yeni: Durum): KatmanIzi => {
    ev('cagiran', 'cagiran', 'not', 'console.log(…)', sat('console.log(oduncAlmaController.istekKarsila('));
    return { olaylar, yanit, durum: yeni, cikti: nodeInspect(yanit).split('\n') };
  };

  ev(
    'cagiran',
    'controller',
    'cagri',
    `istekKarsila({ ogrenciNumarasi: ${q(istek.ogrenciNumarasi)}, kitapKodu: ${q(istek.kitapKodu)} })`,
    sat('console.log(oduncAlmaController.istekKarsila('),
  );

  const eksik = !istek.ogrenciNumarasi || !istek.kitapKodu;
  ev('controller', 'controller', 'not', eksik ? 'zorunlu alanlar eksik' : 'zorunlu alanlar tamam', sat('if (!istek.ogrenciNumarasi'));
  if (eksik) {
    const mesaj = 'Zorunlu alanlar eksiktir.';
    ev('controller', 'cagiran', 'donus', '400', sat(mesaj));
    return bitir({ durumKodu: 400, mesaj }, durum);
  }

  const hata = (mesaj: string): KatmanIzi => {
    ev('service', 'controller', 'firlat', `Error(${q(mesaj)})`, sat(`throw new Error(${q(mesaj)})`));
    ev('controller', 'cagiran', 'donus', '400', sat('mesaj: (hata as Error).message'));
    return bitir({ durumKodu: 400, mesaj }, durum);
  };

  ev('controller', 'service', 'cagri', 'oduncAl(istek)', sat('this.oduncAlmaService.oduncAl(istek)'));

  const kitap = durum.kitaplar.find((k) => k.kod === istek.kitapKodu);
  ev('service', 'kitapRepo', 'cagri', `kitapBul(${q(istek.kitapKodu)})`, sat('this.kitapRepository.kitapBul(istek.kitapKodu)'));
  ev('kitapRepo', 'service', 'donus', kitap ? `Kitap ${q(kitap.kod)}` : 'undefined', sat('return this.kitapListesi.find('));

  const ogrenci = durum.ogrenciler.find((o) => o.numara === istek.ogrenciNumarasi);
  ev(
    'service',
    'ogrenciRepo',
    'cagri',
    `ogrenciBul(${q(istek.ogrenciNumarasi)})`,
    sat('this.ogrenciRepository.ogrenciBul(istek.ogrenciNumarasi)'),
  );
  ev('ogrenciRepo', 'service', 'donus', ogrenci ? `Öğrenci ${q(ogrenci.numara)}` : 'undefined', sat('return this.ogrenciListesi.find('));

  if (!kitap) return hata('Kitap bulunamadı.');
  ev('service', 'service', 'not', 'kitap var', sat('if (!kitap) throw'));
  if (!ogrenci) return hata('Öğrenci bulunamadı.');
  ev('service', 'service', 'not', 'öğrenci var', sat('if (!ogrenci) throw'));
  if (!kitap.uygunMu) return hata('Kitap uygun değildir.');
  ev('service', 'service', 'not', 'uygunMu true', sat('if (!kitap.uygunMu) throw'));
  if (ogrenci.mevcutOduncSayisi >= 3) return hata('Öğrenci limitine ulaştı.');
  ev('service', 'service', 'not', `${ogrenci.mevcutOduncSayisi} < 3`, sat('if (ogrenci.mevcutOduncSayisi >= 3)'));

  ev('service', 'kitapRepo', 'cagri', `kitabiOduncteIsaretle(${q(kitap.kod)})`, sat('this.kitapRepository.kitabiOduncteIsaretle('));
  ev('kitapRepo', 'kitapRepo', 'not', `kitapBul(${q(kitap.kod)}) içeride`, sat('const kitap = this.kitapBul(kitapKodu)'));
  ev('kitapRepo', 'service', 'donus', 'uygunMu = false', sat('if (kitap) kitap.uygunMu = false'));
  ev('service', 'ogrenciRepo', 'cagri', `oduncSayisiniArtir(${q(ogrenci.numara)})`, sat('this.ogrenciRepository.oduncSayisiniArtir('));
  ev('ogrenciRepo', 'service', 'donus', `mevcutOduncSayisi = ${ogrenci.mevcutOduncSayisi + 1}`, sat('if (ogrenci) ogrenci.mevcutOduncSayisi++'));

  const mesaj = `${kitap.ad} başarıyla ödünç verildi.`;
  ev('service', 'controller', 'donus', q(mesaj), sat('return `${kitap.ad} başarıyla ödünç verildi.`'));
  ev('controller', 'cagiran', 'donus', '201', sat('return { durumKodu: 201'));

  const yeni: Durum = {
    kitaplar: durum.kitaplar.map((k) => (k.kod === kitap.kod ? { ...k, uygunMu: false } : k)),
    ogrenciler: durum.ogrenciler.map((o) =>
      o.numara === ogrenci.numara ? { ...o, mevcutOduncSayisi: o.mevcutOduncSayisi + 1 } : o,
    ),
  };
  return bitir({ durumKodu: 201, mesaj }, yeni);
}
