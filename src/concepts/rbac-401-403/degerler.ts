/** Ders values (R17): generated once with node:crypto scryptSync(parola, salt, 64) as Kod 10.7 hashes; the unit test re-derives them. */
export const SALT_YASEMIN = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
export const SALT_ELIF = '1a2b3c4d5e6f708192a3b4c5d6e7f809';
export const PAROLA = { yasemin: 'kutuphaneci-Parola1', elif: 'ogrenci-Parola1' } as const;
export const YANLIS_PAROLA = 'yanlis-parola';

/** Key `${parola}|${salt}` → 128 hex characters. */
export const HASHLER: Readonly<Record<string, string>> = {
  [`${PAROLA.yasemin}|${SALT_YASEMIN}`]: '05bfbe35e07a8694e3dcfc964f91f7cce7c8a3719cacc1ab3d9450098ab719d57fefb51e0a02c0b7f277ac3223ebb2b0f68514d6eb1088f359c4e066ac0d0ec3',
  [`${PAROLA.elif}|${SALT_ELIF}`]: '0909367e59bad8980c685da0627e3c77ca1682a7023c7b7af568c2528a8dc4096eb6325afb7580a5c4df0bf08954415da26eb99ef260d40524aea7cbd0d44f07',
  [`${YANLIS_PAROLA}|${SALT_YASEMIN}`]: '2400aa65c46cd0b32ad3e74d7741f7a76d1e1f0d13ab182abc77c633f5ace410d66a3f35340e70205fb26cfd362dee5569a757f9f074f029e1642a324c44383a',
  [`${YANLIS_PAROLA}|${SALT_ELIF}`]: '6c0ab196d584b16189c88df7eccbca5ce7a53a2fcd43307ae13005191a6ac240863f8ba7c86acd781598e0ca1bd7b29b239bc2d59c4d6010e38e5fc09233175e',
};
