import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { Lane, Message, SequenceSpec } from '../../core/plot/sequence';
import { MINI_APP, MINI_APP_FILE } from './code-text';
import { notSorgula, type Katman, type UygulamaIstegi, type UygulamaYaniti } from './flow';
import type { IstekParams } from './scenario';

export type { IstekParams } from './scenario';

export interface IstekView {
  sequence: SequenceSpec;
  istekKarti: UygulamaIstegi | null;
  yanit: UygulamaYaniti | null;
  code: CodeTraceSpec;
  terminal: string[];
  ozet: { yol: string; yetkiliMi: boolean; durduran: Katman; yanit: UygulamaYaniti }[] | null;
}

export const LANES: Lane[] = [
  { id: 'istemci', label: ['İstemci'], sub: 'TarayiciIstemcisi' },
  { id: 'tersVekil', label: ['Ters vekil'], sub: 'TersVekil' },
  { id: 'notApi', label: ['API'], sub: 'NotApi' },
  { id: 'backend', label: ['Backend servisi'], sub: 'NotBackendServisi' },
];

/** The book's three calls (Kod 1.5), as the summary view lists them. */
const KITAP_CAGRILARI: readonly { no: string; yetkiliMi: boolean }[] = [
  { no: '2026001', yetkiliMi: true },
  { no: '2026001', yetkiliMi: false },
  { no: '2026999', yetkiliMi: true },
];

/** Everything the scene draws for one parameter set; no DOM. */
export function deriveIstekView(p: IstekParams): IstekView {
  const iz = notSorgula(p.yol, p.yetkiliMi);
  const toplam = iz.olaylar.length;
  const olay = Math.max(0, Math.min(toplam, Math.trunc(p.olay) || 0));
  const gorunen = iz.olaylar.slice(0, olay);
  const tamam = olay === toplam;

  const ozet = p.gorunum === 'ozet';
  const ozetIzler = KITAP_CAGRILARI.map((c) => notSorgula(`/api/notlar/${c.no}`, c.yetkiliMi));
  const tam = ozet ? notSorgula('/api/notlar/2026001', true) : iz;
  const shown = ozet ? tam.olaylar : gorunen;
  const sonOlay = shown[shown.length - 1];

  const messages: Message[] = shown.map((o, i) => ({
    id: `m${i}`,
    from: o.from,
    to: o.to,
    label: o.label,
    kind: o.kind,
    ...(o.ok === false || (o.kind === 'response' && Number(o.label) >= 400) ? { tone: 'alarm' as const } : {}),
  }));
  const ilkYanit = shown.some((o) => o.kind === 'response');
  const dokunulan = new Set<string>(shown.flatMap((o) => [o.from, o.to]));
  const sequence: SequenceSpec = {
    lanes: LANES,
    messages,
    ...(messages.length > 0 ? { active: messages[messages.length - 1].id } : {}),
    ...(ilkYanit ? { stopAt: tam.durduran } : {}),
    ...(ilkYanit ? { stopTone: tam.yanit.durumKodu === 200 ? ('ok' as const) : ('alarm' as const) } : {}),
    ariaLabel: 'İstek-yanıt sıra diyagramı',
    dim: ozet || tamam ? LANES.map((l) => l.id).filter((id) => !dokunulan.has(id)) : [],
  };

  return {
    sequence,
    istekKarti: ozet ? tam.istek : olay > 0 ? iz.istek : null,
    yanit: ozet || tamam ? tam.yanit : null,
    code: { title: MINI_APP_FILE, lines: MINI_APP, active: sonOlay ? [sonOlay.line] : [] },
    terminal: ozet ? ozetIzler.map((z) => z.cikti) : tamam ? [iz.cikti] : [],
    ozet: ozet
      ? ozetIzler.map((z) => ({ yol: z.istek.yol, yetkiliMi: z.istek.yetkiliMi, durduran: z.durduran, yanit: z.yanit }))
      : null,
  };
}
