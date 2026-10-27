import type { Listing } from '../src/core/listing';

export function karsilastir(
  kitap: readonly string[],
  l: Listing,
): { satir: number; beklenen: string; bulunan: string } | null;
export function kitapDizini(): string;
