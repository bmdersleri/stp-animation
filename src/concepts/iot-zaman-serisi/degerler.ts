import { CIHAZ_ANAHTARLARI, imzaUret, type SaatOzeti } from './telemetri';

/** Lesson values (R23, R36). Each constant is reproduced by a unit test with node:crypto `createHmac`. */
export const ANAHTAR = 'super-gizli-cihaz-anahtari-12345';
export const GOVDE = JSON.stringify({ cihazId: 'esp32-lab101-temp', sicaklik: 21.5, nem: 45.2 });
export const GOVDE_DEGISMIS = JSON.stringify({ cihazId: 'esp32-lab101-temp', sicaklik: 31.5, nem: 45.2 });
export const IMZA = 'bc27259801b8ac4b17c1cfe70a03f12f71ad16c462699066c5a221494bf08732';
export const IMZA_ESKI = 'ae65743bc19dea7ff85bf5f36d1ceb81bb2f5ada4d026f5b95be69b0cb0f02ee';
export const IMZA_DEGISMIS = '40a614a3127ec472f3e6595a1836e996c6ee9e2489d8d0068e3b3423e1308603';
export const IMZA_GERIDE = '16a2a5dfc935eb193a2b6688305e73731a5987bb791250cf503a543a45939108';

/** `${zamanDamgasi}.${govde}` to signature, for the four lesson packets. */
export const IMZA_ONBELLEK: Readonly<Record<string, string>> = {
  [`1788602400.${GOVDE}`]: IMZA,
  [`1788602339.${GOVDE}`]: IMZA_ESKI,
  [`1788602400.${GOVDE_DEGISMIS}`]: IMZA_DEGISMIS,
  [`1788602355.${GOVDE}`]: IMZA_GERIDE,
};

/** Cache first, otherwise computed live. */
export function imzaAl(zamanDamgasi: number, govdeMetni: string): string {
  return IMZA_ONBELLEK[`${zamanDamgasi}.${govdeMetni}`] ?? imzaUret(CIHAZ_ANAHTARLARI['esp32-lab101-temp'], zamanDamgasi, govdeMetni);
}

/** Hourly summary of the 100 written rows of the fixed series (spec Bölüm 4); a literal, checked against an independent sum in the test. */
export const DERS_OZETI: readonly SaatOzeti[] = [
  { saatDilimi: Date.UTC(2026, 8, 5, 7), ortalama: '20.65', enDusuk: 20.0, enYuksek: 21.3, ornekSayisi: 40 },
  { saatDilimi: Date.UTC(2026, 8, 5, 8), ortalama: '21.65', enDusuk: 21.0, enYuksek: 22.3, ornekSayisi: 40 },
  { saatDilimi: Date.UTC(2026, 8, 5, 9), ortalama: '22.40', enDusuk: 22.0, enYuksek: 22.8, ornekSayisi: 20 },
];
