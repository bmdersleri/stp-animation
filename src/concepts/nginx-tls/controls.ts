import type { StepPlayer } from '../../core/player';
import type { NginxTlsParams } from './scenario';

let uid = 0;

const HEDEFLER: readonly (readonly [NginxTlsParams['hedef'], string])[] = [
  ['http-80', 'http:80'], ['https-443', 'https:443'], ['port-3000', ':3000'], ['port-5432', ':5432'],
];
const AYARLAR: readonly (readonly [NginxTlsParams['ayar'], string])[] = [
  ['kod-15-3', 'Kod 15.3 (yalnız 80, başlıklı)'], ['kod-15-5', 'Kod 15.5 (301 + TLS)'],
  ['code-007', 'Yanlış: yönlendirmesiz HTTP bloğu'], ['basliksiz', 'Başlıksız proxy'],
];
const UYGULAMALAR: readonly (readonly [NginxTlsParams['uygulama'], string])[] = [['ayakta', 'ayakta'], ['kapali', 'kapalı']];
const TRUST: readonly (readonly [string, string])[] = [['0', 'kapalı'], ['1', '1'], ['2', '2']];
const XFF: readonly (readonly [string, string])[] = [['yok', 'yok'], ['var', '1.2.3.4']];

/** A Lab change writes `patch`; the Lab always shows the request flow, so `asama` is `akis`. */
function degistir(player: StepPlayer<NginxTlsParams>, patch: Partial<NginxTlsParams>): void {
  player.setParams({ ...patch, asama: 'akis' });
}

/** Mounts the Lab controls: target, Nginx setting, application state, trust proxy, forged XFF and certificate days left. */
export function mountNginxParams(host: HTMLElement, player: StepPlayer<NginxTlsParams>): void {
  const doc = host.ownerDocument;
  const prefix = `nginx-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'nginx-params';
  host.append(wrap);

  const row = (text: string, input: HTMLElement): HTMLDivElement => {
    const box = doc.createElement('div');
    box.className = 'ctl';
    input.id = `${prefix}-${input.getAttribute('name')}`;
    const label = doc.createElement('label');
    label.className = 'ctl-label';
    label.htmlFor = input.id;
    label.textContent = text;
    box.append(label, input);
    wrap.append(box);
    return box;
  };
  const select = (name: string, options: readonly (readonly [string, string])[]): HTMLSelectElement => {
    const s = doc.createElement('select');
    s.name = name;
    s.replaceChildren(...options.map(([value, text]) => {
      const o = doc.createElement('option');
      o.value = value;
      o.textContent = text;
      return o;
    }));
    return s;
  };

  const hedef = select('hedef', HEDEFLER);
  row('Hedef', hedef);
  const ayar = select('ayar', AYARLAR);
  row('Nginx ayarı', ayar);
  const uygulama = select('uygulama', UYGULAMALAR);
  row('Uygulama', uygulama);
  const trust = select('trustProxy', TRUST);
  row('trust proxy', trust);
  const xff = select('sahteXff', XFF);
  row('Sahte X-Forwarded-For', xff);
  const kalan = doc.createElement('input');
  kalan.type = 'range';
  kalan.name = 'kalanGun';
  kalan.min = '0';
  kalan.max = '90';
  kalan.step = '1';
  const kalanCikti = doc.createElement('output');
  kalanCikti.className = 'ctl-value';
  row('Sertifikanın kalan günü', kalan).append(kalanCikti);

  hedef.addEventListener('change', () => degistir(player, { hedef: hedef.value as NginxTlsParams['hedef'] }));
  ayar.addEventListener('change', () => degistir(player, { ayar: ayar.value as NginxTlsParams['ayar'] }));
  uygulama.addEventListener('change', () => degistir(player, { uygulama: uygulama.value as NginxTlsParams['uygulama'] }));
  trust.addEventListener('change', () => degistir(player, { trustProxy: Number(trust.value) as NginxTlsParams['trustProxy'] }));
  xff.addEventListener('change', () => degistir(player, { sahteXff: xff.value === 'var' }));
  kalan.addEventListener('input', () => degistir(player, { kalanGun: Number(kalan.value) }));

  const sync = (): void => {
    const p = player.state.params;
    hedef.value = p.hedef;
    ayar.value = p.ayar;
    uygulama.value = p.uygulama;
    trust.value = String(p.trustProxy);
    xff.value = p.sahteXff ? 'var' : 'yok';
    kalan.value = String(p.kalanGun);
    kalanCikti.textContent = `${p.kalanGun} gün`;
  };
  sync();
  player.subscribe(sync);
}
