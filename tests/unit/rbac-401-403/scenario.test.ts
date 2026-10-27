import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { RBAC_ROZET, rbacScenario as sc, type RbacParams } from '../../../src/concepts/rbac-401-403/scenario';
import { deriveRbacView } from '../../../src/concepts/rbac-401-403/view';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'kayit', 'giris', 'kutuphaneci-201', 'ogrenci-403', 'gecersiz-401', 'yanlis-parola', 'bearer', 'sira', 'yanlis-kod', 'ozet'];
const ROZET: [string, string][] = [
  ['kitap', 'L845, L848'],
  ['kitap-kodu', 'L1263'],
  ['kitap-kodu', 'L1264'],
  ['kitap', 'L1254'],
  ['kitap', 'L1255, L1265'],
  ['kitap', 'L1256'],
  ['kitap-kodu', 'L1206, L955'],
  ['kitap-kodu', 'L645, L679'],
  ['kitap', 'L912-917, L920'],
  ['kitap-kodu', 'L853, L950'],
  ['kitap', 'L926-931, L1280'],
];

describe('rbac-401-403 scenario', () => {
  it('has 11 steps with spec ids', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('badges match table', () => {
    IDS.forEach((id, i) => expect([RBAC_ROZET[id]?.tur, RBAC_ROZET[id]?.ref], id).toEqual(ROZET[i]));
  });

  it('every step gives every param and the documented defaults hold', () => {
    expect(sc.defaults).toEqual({ program: 'kod-10-7', asama: 'kitap-ekle', kullanici: 'yasemin', parola: 'dogru', token: 'giris', dakika: 0, roller: 'kutuphaneci' });
    for (const s of sc.steps) expect(Object.keys(s.params!).sort(), s.id).toEqual(Object.keys(sc.defaults).sort());
  });

  it('kitap-badged steps show no computed values', () => {
    const kitap = sc.steps.filter((s) => RBAC_ROZET[s.id].tur === 'kitap');
    expect(kitap.map((s) => s.id)).toEqual(['tanitim', 'kutuphaneci-201', 'ogrenci-403', 'gecersiz-401', 'sira', 'ozet']);
    for (const s of kitap) {
      const metin = JSON.stringify(deriveRbacView(s.params as RbacParams, true));
      expect(metin, s.id).not.toContain('eyJ');
      expect(metin, s.id).not.toMatch(/[0-9a-f]{32}/);
      expect(metin, s.id).not.toMatch(/[0-9a-f]{128}/);
      expect(metin, s.id).not.toContain('durumMetni');
    }
  });

  it('the bearer step says /kitaplar belongs to the page', () => {
    expect(sc.steps[7].text).toContain('/kitaplar yolu bu sayfaya aittir');
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});
