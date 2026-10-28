import { createHash, createHmac, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { b64urlCoz, b64urlJson, b64urlMetin, hmacSha256B64url, hmacSha256Hex, NODE_SCRYPT, rastgeleSaltHex, scryptHex, sha256Hex } from '../../../src/core/kripto';

const TR = 'şifreİğ🙂';
const JWT_ISLENEN = 'eyJhbGciOiJIUzI1NiIsInRpcCI6IkpXVCJ9.eyJrdWxsYW5pY2lBZGkiOiJlbGlmIiwicm9sIjoib2dyZW5jaSIsInNvbkdlY2VybGlsaWsiOjE3ODg2MDc0Mjg2MDB9';

describe('kripto', () => {
  it('hmac hex matches node', () => {
    const veri = '1788602400.{"cihazId":"esp32-lab101-temp","sicaklik":21.5,"nem":45.2}';
    expect(hmacSha256Hex('super-gizli-cihaz-anahtari-12345', veri)).toBe('bc27259801b8ac4b17c1cfe70a03f12f71ad16c462699066c5a221494bf08732');
    expect(hmacSha256Hex('super-gizli-cihaz-anahtari-12345', veri)).toBe(createHmac('sha256', 'super-gizli-cihaz-anahtari-12345').update(veri).digest('hex'));
    expect(hmacSha256Hex(TR, TR)).toBe(createHmac('sha256', TR).update(TR).digest('hex'));
    expect(hmacSha256Hex(TR, 'x')).toBe(createHmac('sha256', TR).update('x').digest('hex'));
    expect(hmacSha256Hex('k', TR)).toBe(createHmac('sha256', 'k').update(TR).digest('hex'));
  });

  it('sha256 matches node', () => {
    expect(sha256Hex('123456')).toBe('8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92');
    expect(sha256Hex('123456')).toBe(createHash('sha256').update('123456').digest('hex'));
  });

  it('hmac matches node', () => {
    expect(hmacSha256B64url('kutuphane-sunucu-sirri', JWT_ISLENEN)).toBe('p1aKZ8iwwpShCIkzPs1HH23xYmZSUhwPknpJRwVpavM');
    expect(hmacSha256B64url('kutuphane-sunucu-sirri', JWT_ISLENEN)).toBe(createHmac('sha256', 'kutuphane-sunucu-sirri').update(JWT_ISLENEN).digest('base64url'));
  });

  it('b64urlJson matches Buffer base64url', () => {
    const o = { alg: 'HS256', tip: 'JWT' };
    expect(b64urlJson(o)).toBe('eyJhbGciOiJIUzI1NiIsInRpcCI6IkpXVCJ9');
    expect(b64urlJson(o)).toBe(Buffer.from(JSON.stringify(o)).toString('base64url'));
    expect(b64urlMetin('{bozuk')).toBe(Buffer.from('{bozuk').toString('base64url'));
  });

  it('b64urlCoz round-trips and rejects invalid input', () => {
    expect(b64urlCoz(b64urlMetin(TR))).toBe(TR);
    expect(JSON.parse(b64urlCoz(b64urlJson({ a: 'ç' })))).toEqual({ a: 'ç' });
    expect(() => b64urlCoz('**')).toThrow(Error);
  });

  it('scrypt matches node scryptSync', async () => {
    const salt = 'a3f1c2d4e5b60718293a4b5c6d7e8f90';
    const hex = await scryptHex('guclu-Parola123', salt);
    expect(hex).toBe(scryptSync('guclu-Parola123', salt, 64).toString('hex'));
    expect(hex.startsWith('cc62223a327ab808')).toBe(true);
    expect(NODE_SCRYPT).toEqual({ N: 16384, r: 8, p: 1, dkLen: 64 });
  });

  it('kripto matches node for Turkish and emoji input', () => {
    expect(sha256Hex(TR)).toBe(createHash('sha256').update(TR).digest('hex'));
    expect(hmacSha256B64url(TR, TR)).toBe(createHmac('sha256', TR).update(TR).digest('base64url'));
    expect(b64urlJson({ ad: TR })).toBe(Buffer.from(JSON.stringify({ ad: TR })).toString('base64url'));
  });

  it('random salt is 32 hex chars and differs', () => {
    const a = rastgeleSaltHex();
    const b = rastgeleSaltHex();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
