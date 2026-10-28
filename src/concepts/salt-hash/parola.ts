import { scryptHex, sha256Hex } from '../../core/kripto';
import { farkIndeksleri } from '../../core/plot/segment-strip';
import { SCRYPT_ONBELLEK } from './degerler';

export interface HashlenmisParola {
  salt: string;
  hash: string;
}

/** Cached Ders value for (parola, salt), when there is one. */
export function onbellekten(parola: string, salt: string): string | undefined {
  return SCRYPT_ONBELLEK[`${parola}|${salt}`];
}

async function turet(parola: string, salt: string): Promise<string> {
  return onbellekten(parola, salt) ?? (await scryptHex(parola, salt));
}

export async function parolaHashle(parola: string, salt: string): Promise<HashlenmisParola> {
  return { salt, hash: await turet(parola, salt) };
}

/** `ilkFark` is the first differing hex index, -1 when the hashes are equal. */
export async function parolaDogrula(
  parola: string,
  kayit: HashlenmisParola,
): Promise<{ sonuc: boolean; denemeHash: string; ilkFark: number }> {
  const denemeHash = await turet(parola, kayit.salt);
  const fark = farkIndeksleri(denemeHash, kayit.hash);
  return { sonuc: fark.length === 0, denemeHash, ilkFark: fark.length === 0 ? -1 : fark[0] };
}

/** The book's code_004: unsalted sha256. */
export function guvensizHashle(parola: string): string {
  return sha256Hex(parola);
}

/** Work done by the comparison: `esittir` stops at the first difference (hex chars), `timingSafeEqual` always covers 64 bytes. */
export function karsilastirmaAdimi(a: string, b: string, yontem: 'esittir' | 'timingSafeEqual'): number {
  if (yontem === 'timingSafeEqual') return 64;
  const fark = farkIndeksleri(a, b);
  return fark.length === 0 ? a.length : fark[0] + 1;
}
