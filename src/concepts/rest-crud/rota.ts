import type { HttpIstek } from '../../core/plot/http-cards';

export type LabIstekId =
  | 'post-santrifuj'
  | 'post-bos'
  | 'get-liste-1-2'
  | 'get-liste-0-2'
  | 'get-1'
  | 'get-99'
  | 'patch-1-rezerve'
  | 'patch-99';
export type IdemIstekId = 'delete-12' | 'post-anahtar-7' | 'post-anahtar-9' | 'stok-ayarla-5' | 'stok-artir-1';
export type IstekId = LabIstekId | IdemIstekId;

/** `istek` is absent for the two stock updates: they are plain function calls, not HTTP requests. */
export interface IstekTanimi {
  id: IstekId;
  etiket: string;
  istek?: HttpIstek;
  cagri: string;
}

const json = (g: unknown): string => JSON.stringify(g, null, 2);
const EKIPMANLAR = '/api/ekipmanlar';
const ANAHTAR: [string, string][] = [['Idempotency-Key', 'rzv-7f3a']];
const rezervasyon = (ekipmanKimligi: number): HttpIstek => ({
  metot: 'POST',
  yol: '/api/rezervasyonlar',
  basliklar: ANAHTAR,
  govde: json({ ekipmanKimligi, ogrenci: 'Elif' }),
});

export const ISTEKLER: {
  readonly 'laboratuvar-api': readonly IstekTanimi[];
  readonly idempotentlik: readonly IstekTanimi[];
} = {
  'laboratuvar-api': [
    { id: 'post-santrifuj', etiket: 'POST Santrifüj', istek: { metot: 'POST', yol: EKIPMANLAR, govde: json({ ad: 'Santrifüj' }) }, cagri: 'ekipmanOlustur("Santrifüj")' },
    { id: 'post-bos', etiket: 'POST boş ad', istek: { metot: 'POST', yol: EKIPMANLAR, govde: json({ ad: '   ' }) }, cagri: 'ekipmanOlustur("   ")' },
    { id: 'get-liste-1-2', etiket: 'GET liste (sayfa 1)', istek: { metot: 'GET', yol: `${EKIPMANLAR}?sayfa=1&sayfaBoyutu=2` }, cagri: 'ekipmanlariListele(1, 2)' },
    { id: 'get-liste-0-2', etiket: 'GET liste (sayfa 0)', istek: { metot: 'GET', yol: `${EKIPMANLAR}?sayfa=0&sayfaBoyutu=2` }, cagri: 'ekipmanlariListele(0, 2)' },
    { id: 'get-1', etiket: 'GET /1', istek: { metot: 'GET', yol: `${EKIPMANLAR}/1` }, cagri: 'ekipmanGetir(1)' },
    { id: 'get-99', etiket: 'GET /99', istek: { metot: 'GET', yol: `${EKIPMANLAR}/99` }, cagri: 'ekipmanGetir(99)' },
    { id: 'patch-1-rezerve', etiket: 'PATCH /1 rezerve', istek: { metot: 'PATCH', yol: `${EKIPMANLAR}/1`, govde: json({ durum: 'rezerve' }) }, cagri: 'ekipmanDurumunuGuncelle(1, "rezerve")' },
    { id: 'patch-99', etiket: 'PATCH /99', istek: { metot: 'PATCH', yol: `${EKIPMANLAR}/99`, govde: json({ durum: 'rezerve' }) }, cagri: 'ekipmanDurumunuGuncelle(99, "rezerve")' },
  ],
  idempotentlik: [
    { id: 'stok-ayarla-5', etiket: 'stokuAyarla(5)', cagri: 'stokuAyarla(5)' },
    { id: 'stok-artir-1', etiket: 'stokuArtir(1)', cagri: 'stokuArtir(1)' },
    { id: 'delete-12', etiket: 'DELETE /12', istek: { metot: 'DELETE', yol: `${EKIPMANLAR}/12` }, cagri: 'ekipmanSil(12)' },
    { id: 'post-anahtar-7', etiket: 'POST anahtar (ekipman 7)', istek: rezervasyon(7), cagri: 'rezervasyonOlustur("rzv-7f3a", 7, "Elif")' },
    { id: 'post-anahtar-9', etiket: 'POST anahtar (ekipman 9)', istek: rezervasyon(9), cagri: 'rezervasyonOlustur("rzv-7f3a", 9, "Elif")' },
  ],
};
