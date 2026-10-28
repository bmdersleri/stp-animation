/** Ders values (R2, R3): generated once with node:crypto scryptSync(parola, salt, 64); the unit test re-derives them. */
export const SALT_1 = 'a3f1c2d4e5b60718293a4b5c6d7e8f90';
export const SALT_2 = '5e0c9b8a7f6d5c4b3a29180f7e6d5c4b';

/** Key `${parola}|${salt}` → 128 hex characters. */
export const SCRYPT_ONBELLEK: Readonly<Record<string, string>> = {
  [`guclu-Parola123|${SALT_1}`]: 'cc62223a327ab808a8a0f9dd2fa03c9ede08412763b65e653ae760fdb052272764a042eb84bdaf33d380ddd2a268644726d8913c5e2d8d62bed6e2cca96d8582',
  [`guclu-Parola123|${SALT_2}`]: 'd3d03cc76308e4e4d56c4726a807b2b5165f55278d60befb9dd35f13d5297d0643cfdb2881750cec7ddc13830899cb7bfed10d6d652e7c3a391344d749768330',
  [`yanlis-parola|${SALT_1}`]: '188d49cb0f92460a861e65ad7e1e298964bcda101c97aceabf8afb61b563b8fee22fa63188434053b525cbd4a3febd2dbe7e35fc52bf6307fc7a9f1c566374f3',
  [`yanlis-parola|${SALT_2}`]: 'cb3c9cefac1217db6323143ff1e0836a7a37de1cc3454129a77079659505722254cc1da8d7e6ca60eca8d0ada7a34262b960bb49439b35c449998bd80dcbfb7d',
};

/** sha256("123456"). */
export const SHA_123456 = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
