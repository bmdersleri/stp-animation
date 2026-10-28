import { hmac } from '@noble/hashes/hmac.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/** Real crypto for the security pages: browser-safe (no Node built-ins, no Buffer), byte-identical with Node `crypto`. */

export interface ScryptAyar {
  N: number;
  r: number;
  p: number;
  dkLen: number;
}
/** The defaults of Node `scryptSync(parola, salt, 64)`. */
export const NODE_SCRYPT: ScryptAyar = { N: 16384, r: 8, p: 1, dkLen: 64 };

const kodla = (metin: string): Uint8Array => new TextEncoder().encode(metin);

function b64url(bayt: Uint8Array): string {
  let ikili = '';
  for (const b of bayt) ikili += String.fromCharCode(b);
  return btoa(ikili).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function sha256Hex(metin: string): string {
  return bytesToHex(sha256(kodla(metin)));
}

export function hmacSha256B64url(anahtar: string, veri: string): string {
  return b64url(hmac(sha256, kodla(anahtar), kodla(veri)));
}

/** JSON.stringify, UTF-8, base64url without padding. */
export function b64urlJson(deger: object): string {
  return b64url(kodla(JSON.stringify(deger)));
}

/** UTF-8 text to base64url (for a body that is not valid JSON). */
export function b64urlMetin(metin: string): string {
  return b64url(kodla(metin));
}

/** base64url to UTF-8 text; throws `Error` on a character outside the base64url alphabet. */
export function b64urlCoz(parca: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(parca) || parca.length % 4 === 1) throw new Error('Geçersiz base64url');
  const b64 = parca.replace(/-/g, '+').replace(/_/g, '/');
  const ikili = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bayt = Uint8Array.from(ikili, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bayt);
}

/** The salt is text: its UTF-8 bytes are used (the hex string itself, as in Node `scryptSync(parola, salt, 64)`). */
export async function scryptHex(parola: string, salt: string, ayar: ScryptAyar = NODE_SCRYPT): Promise<string> {
  const anahtar = await scryptAsync(kodla(parola), kodla(salt), { ...ayar, asyncTick: 10 });
  return bytesToHex(anahtar);
}

export function rastgeleSaltHex(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}
