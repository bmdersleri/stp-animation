import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { NGINX_ROZET, nginxScenario as sc, type NginxTlsParams } from '../../../src/concepts/nginx-tls/scenario';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'guvenlik-duvari', 'proxy-80', 'basliksiz-ip', 'xff-ayikla', 'trust-proxy', 'yonlendirme-301', 'tls-sonlandirma', 'certbot', 'bad-gateway-502', 'ozet'];
const ROZET: [string, string][] = [
  ['kitap', 'L259, L266, L278'],
  ['kitap-kodu', 'L174, L215-221'],
  ['kitap-kodu', 'L303-307, L317-318'],
  ['kitaba-dayali', 'L321, L351'],
  ['kitap', 'L363-364, L369'],
  ['standart', 'Express; L355'],
  ['kitap-kodu', 'L456, L477, L482'],
  ['standart', 'TLS, Nginx; L479'],
  ['kitaba-dayali', 'L524-528, L566'],
  ['kitaba-dayali', 'L278'],
  ['kitap', 'L330-335, L491-496, L959'],
];
const LAB = { asama: 'akis', hedef: 'https-443', ayar: 'kod-15-5', uygulama: 'ayakta', trustProxy: 0, sahteXff: false, kalanGun: 60 };

describe('nginx-tls scenario', () => {
  it('has 11 steps with spec ids', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('badges match table', () => {
    IDS.forEach((id, i) => expect([NGINX_ROZET[id]?.tur, NGINX_ROZET[id]?.ref], id).toEqual(ROZET[i]));
  });

  it('every step gives every param and the defaults are the Lab values', () => {
    expect(sc.defaults).toEqual(LAB);
    for (const s of sc.steps) expect(Object.keys(s.params!).sort(), s.id).toEqual(Object.keys(LAB).sort());
  });

  it('step params differ from the defaults as the table says', () => {
    const p = (id: string) => sc.steps[stepIndex(sc, id)].params as NginxTlsParams;
    expect(p('tanitim')).toEqual({ ...LAB, asama: 'tanitim' });
    expect(p('guvenlik-duvari')).toEqual({ ...LAB, asama: 'ufw', hedef: 'port-5432' });
    expect(p('proxy-80')).toEqual({ ...LAB, hedef: 'http-80', ayar: 'kod-15-3' });
    expect(p('basliksiz-ip')).toEqual({ ...LAB, hedef: 'http-80', ayar: 'basliksiz' });
    expect(p('xff-ayikla')).toEqual({ ...LAB, asama: 'xff' });
    expect(p('trust-proxy')).toEqual({ ...LAB, hedef: 'http-80', ayar: 'kod-15-3', sahteXff: true, trustProxy: 1 });
    expect(p('yonlendirme-301')).toEqual({ ...LAB, hedef: 'http-80' });
    expect(p('tls-sonlandirma')).toEqual(LAB);
    expect(p('certbot')).toEqual({ ...LAB, asama: 'certbot', kalanGun: 90 });
    expect(p('bad-gateway-502')).toEqual({ ...LAB, uygulama: 'kapali' });
    expect(p('ozet')).toEqual({ ...LAB, asama: 'ozet' });
  });

  labTextTests(sc.steps, [3, 6, 8, 10]);
});
