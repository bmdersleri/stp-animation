import type { Listing } from '../../core/listing';

/** Book listings of chapter 4 (b04, final.md), verbatim, one string per line. Type-only imports: a Node script imports this file. */
const B04 = 'b04-nodejs-runtime';

export const KOD_4_4: Listing = {
  id: 'kod-4-4',
  title: 'Kod 4.4 · eventLoopSirasi.ts',
  bolum: B04,
  satirlar: [407, 418],
  lines: [
    '// File: eventLoopSirasi.ts',
    '// Önce senkron satırlar çalışır.',
    "// setTimeout callback'i daha sonra kuyruğa gelir.",
    '// Çıktı: Başlangıç, Bitiş, ardından Zamanlayıcı tamamlandı.',
    '',
    'console.log("1. Sipariş alınmaya başlandı.");',
    '',
    'setTimeout(() => {',
    '  console.log("3. Zamanlayıcı tamamlandı.");',
    '}, 1000);',
    '',
    'console.log("2. Başka sipariş işleniyor.");',
  ],
};

export const KOD_4_4_CIKTI: Listing = {
  id: 'kod-4-4-cikti',
  title: 'Kod 4.4 çıktısı',
  bolum: B04,
  satirlar: [423, 425],
  lines: ['1. Sipariş alınmaya başlandı.', '2. Başka sipariş işleniyor.', '3. Zamanlayıcı tamamlandı.'],
};

export const KOD_4_5: Listing = {
  id: 'kod-4-5',
  title: 'Kod 4.5 · asenkronMesaj.ts',
  bolum: B04,
  satirlar: [460, 478],
  lines: [
    '// File: asenkronMesaj.ts',
    '// Promise bekleyen bir işlemi temsil eder.',
    '// await, yalnızca bu async fonksiyonun devamını bekletir.',
    '// Çıktı: Hazırlık, diğer iş, sonra tamamlanma mesajı.',
    '',
    'function siparisHazirla(): Promise<string> {',
    '  return new Promise((coz) => {',
    '    setTimeout(() => coz("Sipariş hazır."), 500);',
    '  });',
    '}',
    '',
    'async function mutfagiYonet(): Promise<void> {',
    '  console.log("Hazırlık başlatıldı.");',
    '  const sonucMesaji = await siparisHazirla();',
    '  console.log(sonucMesaji);',
    '}',
    '',
    'void mutfagiYonet();',
    'console.log("Mutfak başka siparişleri karşılıyor.");',
  ],
};

export const KOD_4_5_CIKTI: Listing = {
  id: 'kod-4-5-cikti',
  title: 'Kod 4.5 çıktısı',
  bolum: B04,
  satirlar: [483, 485],
  lines: ['Hazırlık başlatıldı.', 'Mutfak başka siparişleri karşılıyor.', 'Sipariş hazır.'],
};

export const BITTI_GEC: Listing = {
  id: 'bitti-gec',
  title: 'Yanlış beklenti: Bitti / Geç',
  bolum: B04,
  satirlar: [518, 523],
  lines: [
    "// Yanlış beklenti: Bu satır callback'ten önce çalışır.",
    '// setTimeout işlemi kodu durdurmaz.',
    '// Çıktı: Önce "Bitti", sonra "Geç".',
    '',
    'setTimeout(() => console.log("Geç"), 0);',
    'console.log("Bitti");',
  ],
};

export const BITTI_GEC_CIKTI: Listing = {
  id: 'bitti-gec-cikti',
  title: 'Yanlış beklenti çıktısı',
  bolum: B04,
  satirlar: [528, 529],
  lines: ['Bitti', 'Geç'],
};

export const LISTINGS: readonly Listing[] = [
  KOD_4_4,
  KOD_4_4_CIKTI,
  KOD_4_5,
  KOD_4_5_CIKTI,
  BITTI_GEC,
  BITTI_GEC_CIKTI,
];
