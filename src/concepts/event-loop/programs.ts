import { simulate, type Frame, type Op } from './sim';

export type ProgramId = 'kod-4-4' | 'bitti-gec' | 'kod-4-5' | 'mikro-makro' | 'engelleme';
export interface Program {
  id: ProgramId;
  file: string;
  title: string;
  code: readonly string[];
  ops: Op[];
  bookBased: boolean;
}

export const PROGRAM_IDS: readonly ProgramId[] = ['kod-4-4', 'bitti-gec', 'kod-4-5', 'mikro-makro', 'engelleme'];

const log = (line: number, text: string): Op => ({ op: 'log', line, text });

export const PROGRAMS: Record<ProgramId, Program> = {
  'kod-4-4': {
    id: 'kod-4-4',
    file: 'eventLoopSirasi.ts',
    title: 'Kod 4.4',
    bookBased: true,
    code: [
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
    ops: [
      log(6, '1. Sipariş alınmaya başlandı.'),
      { op: 'timeout', line: 8, ms: 1000, label: 'setTimeout callback', body: [log(9, '3. Zamanlayıcı tamamlandı.')] },
      log(12, '2. Başka sipariş işleniyor.'),
    ],
  },
  'bitti-gec': {
    id: 'bitti-gec',
    file: 'b04-nodejs-runtime_code_008.ts',
    title: 'Yaygın hata: setTimeout(…, 0)',
    bookBased: true,
    code: [
      "// Yanlış beklenti: Bu satır callback'ten önce çalışır.",
      '// setTimeout işlemi kodu durdurmaz.',
      '// Çıktı: Önce "Bitti", sonra "Geç".',
      '',
      'setTimeout(() => console.log("Geç"), 0);',
      'console.log("Bitti");',
    ],
    ops: [
      { op: 'timeout', line: 5, ms: 0, label: 'setTimeout callback', body: [log(5, 'Geç')] },
      log(6, 'Bitti'),
    ],
  },
  'kod-4-5': {
    id: 'kod-4-5',
    file: 'asenkronMesaj.ts',
    title: 'Kod 4.5',
    bookBased: true,
    code: [
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
    ops: [
      {
        op: 'call',
        line: 18,
        name: 'mutfagiYonet',
        body: [
          log(13, 'Hazırlık başlatıldı.'),
          { op: 'await', line: 14, ms: 500, label: 'siparisHazirla', rest: [log(15, 'Sipariş hazır.')] },
        ],
      },
      log(19, 'Mutfak başka siparişleri karşılıyor.'),
    ],
  },
  'mikro-makro': {
    id: 'mikro-makro',
    file: 'mikroMakro.ts',
    title: 'Mikro görev önce',
    bookBased: false,
    code: [
      '// Kitabın cümlesine dayalı örnek: mikro görevler makro görevlerden önce.',
      'setTimeout(() => console.log("Zamanlayıcı"), 0);',
      'Promise.resolve().then(() => console.log("Promise"));',
      'console.log("Senkron");',
    ],
    ops: [
      { op: 'timeout', line: 2, ms: 0, label: 'setTimeout callback', body: [log(2, 'Zamanlayıcı')] },
      { op: 'then', line: 3, label: 'Promise callback', body: [log(3, 'Promise')] },
      log(4, 'Senkron'),
    ],
  },
  engelleme: {
    id: 'engelleme',
    file: 'engelleme.ts',
    title: "Event loop'u bloklama",
    bookBased: false,
    code: [
      "// Kitabın cümlesine dayalı örnek: uzun senkron kod callback'leri geciktirir.",
      'setTimeout(() => console.log("Zamanlayıcı çalıştı."), 1000);',
      'const bitis = Date.now() + 2000;',
      'while (Date.now() < bitis) {',
      '  // 2000 ms boyunca ana iş parçacığı meşgul.',
      '}',
      'console.log("Döngü bitti.");',
    ],
    ops: [
      { op: 'timeout', line: 2, ms: 1000, label: 'setTimeout callback', body: [log(2, 'Zamanlayıcı çalıştı.')] },
      { op: 'busy', line: 4, ms: 2000, label: 'while döngüsü' },
      log(7, 'Döngü bitti.'),
    ],
  },
};

const cache = new Map<ProgramId, Frame[]>();
export function framesOf(id: ProgramId): Frame[] {
  let frames = cache.get(id);
  if (!frames) {
    frames = simulate(PROGRAMS[id].ops);
    cache.set(id, frames);
  }
  return frames;
}
