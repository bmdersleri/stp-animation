import { lineOf, listing, type Listing } from '../../core/listing';
import { nodeInspect } from '../../core/node-inspect';
import { DURUM_METNI, type HttpIstek, type HttpYanit } from '../../core/plot/http-cards';
import type { Message } from '../../core/plot/sequence';
import { LISTINGS } from './code-text';
import { ISTEKLER, type IstekId, type IstekTanimi } from './rota';

export interface Ekipman {
  kimlik: number;
  ad: string;
  durum: 'musait' | 'rezerve';
}
export interface LabDurum {
  ekipmanListesi: readonly Ekipman[];
  sonrakiKimlik: number;
}
export interface Rezervasyon {
  kimlik: number;
  ekipmanKimligi: number;
  ogrenci: string;
}
export interface IdemDurum {
  stok: number;
  ekipmanlar: readonly [number, string][];
  rezervasyonlar: readonly Rezervasyon[];
  anahtarlar: readonly [string, { parmakIzi: string; durumKodu: number; govde: string }][];
}
export type ProgramId = 'laboratuvar-api' | 'idempotentlik';
export interface Gonderim {
  istekId: IstekId;
  /** Absent for the two stock updates (plain function calls). */
  istek?: HttpIstek;
  yanit?: HttpYanit;
  cagri: string;
  olaylar: Message[];
  /** One listing line per event (parallel to `olaylar`). */
  satirlar: readonly number[];
  /** Console output of the book program (laboratuvar-api only). */
  cikti: string[];
}

export const LAB_BASLANGIC: LabDurum = {
  ekipmanListesi: [
    { kimlik: 1, ad: 'Mikroskop', durum: 'musait' },
    { kimlik: 2, ad: 'Spektrometre', durum: 'rezerve' },
  ],
  sonrakiKimlik: 3,
};
export const IDEM_BASLANGIC: IdemDurum = {
  stok: 3,
  ekipmanlar: [[12, 'Santrifüj']],
  rezervasyonlar: [],
  anahtarlar: [],
};

type Ton = 'ok' | 'alarm';
interface Ev {
  from: string;
  to: string;
  label: string;
  kind: Message['kind'];
  tone?: Ton;
  satir: number;
}
/** What a service function did: the response (if any), events between `rota -> servis` and `servis -> rota`. */
interface Sonuc<D> {
  durum: D;
  kod?: number;
  /** Response body object (lab) or JSON text (idempotentlik); `null` = no body. */
  govde?: unknown;
  /** Value `console.log` prints (laboratuvar-api). */
  yaniti?: unknown;
  location?: string;
  olaylar: Ev[];
}

const json = (g: unknown): string => JSON.stringify(g, null, 2);
const ok = (kod: number): Ton => (kod >= 200 && kod < 300 ? 'ok' : 'alarm');

// ---- laboratuvar-api (code_011) -------------------------------------------------------------------------------

function lab(durum: LabDurum, id: IstekId, l: Listing): Sonuc<LabDurum> {
  const at = (sig: string, frag: string): number => lineOf(l, frag, lineOf(l, sig));
  const ev = (from: string, to: string, label: string, kind: Ev['kind'], satir: number, tone?: Ton): Ev => ({ from, to, label, kind, tone, satir });
  const hata = (sig: string, kod: 400 | 404, hataKodu: string, mesaj: string, olaylar: Ev[]): Sonuc<LabDurum> => {
    const yaniti = { durumKodu: kod, basarili: false, hataKodu, mesaj };
    return {
    durum,
    kod,
    govde: yaniti,
    yaniti,
    olaylar: [...olaylar, ev('servis', 'rota', `durumKodu ${kod}`, 'response', at(sig, `durumKodu: ${kod}`), 'alarm')],
    };
  };

  const bul = (sig: string, kimlik: number): { e?: Ekipman; olaylar: Ev[] } => {
    const e = durum.ekipmanListesi.find((x) => x.kimlik === kimlik);
    return {
      e,
      olaylar: [
        ev('servis', 'veri', `find(kimlik === ${kimlik})`, 'request', at(sig, 'this.ekipmanListesi.find')),
        ev('veri', 'servis', e ? `{ kimlik: ${e.kimlik}, ad: '${e.ad}' }` : 'undefined', 'response', at(sig, 'this.ekipmanListesi.find')),
      ],
    };
  };
  const SIG_GETIR = 'ekipmanGetir(kimlik: number)';
  const SIG_GUNCELLE = 'ekipmanDurumunuGuncelle(kimlik';

  switch (id) {
    case 'post-santrifuj':
    case 'post-bos': {
      const ad = id === 'post-bos' ? '   ' : 'Santrifüj';
      const sig = 'ekipmanOlustur(ad: string)';
      const bos = !ad.trim();
      const kontrol = ev('servis', 'servis', '!ad.trim()', 'note', at(sig, '!ad.trim()'), bos ? 'alarm' : 'ok');
      if (bos) return hata(sig, 400, 'GECERSIZ_AD', 'Ekipman adı boş olamaz.', [kontrol]);
      const yeni: Ekipman = { kimlik: durum.sonrakiKimlik, ad, durum: 'musait' };
      const yaniti = { durumKodu: 201, basarili: true, veri: yeni, mesaj: 'Ekipman oluşturuldu.' };
      return {
        durum: { ekipmanListesi: [...durum.ekipmanListesi, yeni], sonrakiKimlik: durum.sonrakiKimlik + 1 },
        kod: 201,
        govde: yaniti,
        yaniti,
        location: `/api/ekipmanlar/${yeni.kimlik}`,
        olaylar: [
          kontrol,
          ev('servis', 'veri', `push(yeniEkipman)`, 'request', at(sig, 'this.ekipmanListesi.push')),
          ev('veri', 'servis', `kimlik ${yeni.kimlik}`, 'response', at(sig, 'kimlik: this.sonrakiKimlik++')),
          ev('servis', 'rota', 'durumKodu 201', 'response', at(sig, 'durumKodu: 201'), 'ok'),
        ],
      };
    }
    case 'get-liste-1-2':
    case 'get-liste-0-2': {
      const sayfa = id === 'get-liste-0-2' ? 0 : 1;
      const sayfaBoyutu = 2;
      const sig = 'ekipmanlariListele(sayfa: number';
      const k1 = !Number.isInteger(sayfa) || sayfa < 1;
      const n1 = ev('servis', 'servis', '!Number.isInteger(sayfa) || sayfa < 1', 'note', at(sig, 'sayfa < 1'), k1 ? 'alarm' : 'ok');
      if (k1) return hata(sig, 400, 'GECERSIZ_SAYFA', 'Sayfa numarası 1 veya daha büyük bir tam sayı olmalıdır.', [n1]);
      const n2 = ev('servis', 'servis', 'sayfaBoyutu 1..100', 'note', at(sig, 'sayfaBoyutu < 1'), 'ok');
      const bas = (sayfa - 1) * sayfaBoyutu;
      const veri = durum.ekipmanListesi.slice(bas, bas + sayfaBoyutu).map((e) => ({ ...e }));
      const yaniti = {
        durumKodu: 200,
        basarili: true,
        veri,
        metadata: { sayfa, sayfaBoyutu, toplamKayit: durum.ekipmanListesi.length },
      };
      return {
        durum,
        kod: 200,
        govde: yaniti,
        yaniti,
        olaylar: [
          n1,
          n2,
          ev('servis', 'veri', `slice(${bas}, ${bas + sayfaBoyutu})`, 'request', at(sig, 'this.ekipmanListesi.slice')),
          ev('veri', 'servis', `${veri.length} kayıt`, 'response', at(sig, 'this.ekipmanListesi.slice')),
          ev('servis', 'rota', 'durumKodu 200', 'response', at(sig, 'durumKodu: 200'), 'ok'),
        ],
      };
    }
    case 'get-1':
    case 'get-99': {
      const kimlik = id === 'get-1' ? 1 : 99;
      const { e, olaylar } = bul(SIG_GETIR, kimlik);
      const kontrol = ev('servis', 'servis', '!bulunanEkipman', 'note', at(SIG_GETIR, '!bulunanEkipman'), e ? 'ok' : 'alarm');
      if (!e) return hata(SIG_GETIR, 404, 'EKIPMAN_BULUNAMADI', 'İstenen ekipman bulunamadı.', [...olaylar, kontrol]);
      const yaniti = { durumKodu: 200, basarili: true, veri: { ...e }, mesaj: 'Ekipman bulundu.' };
      return {
        durum,
        kod: 200,
        govde: yaniti,
        yaniti,
        olaylar: [...olaylar, kontrol, ev('servis', 'rota', 'durumKodu 200', 'response', at(SIG_GETIR, 'durumKodu: 200'), 'ok')],
      };
    }
    default: {
      // patch-1-rezerve / patch-99
      const kimlik = id === 'patch-99' ? 99 : 1;
      const yeniDurum = 'rezerve' as const;
      const { e, olaylar } = bul(SIG_GETIR, kimlik);
      const kontrol = ev('servis', 'servis', '!yanit.basarili', 'note', at(SIG_GUNCELLE, '!yanit.basarili'), e ? 'ok' : 'alarm');
      if (!e) return hata(SIG_GETIR, 404, 'EKIPMAN_BULUNAMADI', 'İstenen ekipman bulunamadı.', [...olaylar, kontrol]);
      const guncel: Ekipman = { ...e, durum: yeniDurum };
      const yaniti = { durumKodu: 200, basarili: true, veri: { ...guncel }, mesaj: 'Ekipman durumu güncellendi.' };
      return {
        durum: { ...durum, ekipmanListesi: durum.ekipmanListesi.map((x) => (x.kimlik === kimlik ? guncel : x)) },
        kod: 200,
        govde: yaniti,
        yaniti,
        olaylar: [
          ...olaylar,
          kontrol,
          ev('servis', 'veri', `durum = "${yeniDurum}"`, 'request', at(SIG_GUNCELLE, 'yanit.veri.durum = durum')),
          ev('servis', 'rota', 'durumKodu 200', 'response', at(SIG_GUNCELLE, 'durumKodu: 200'), 'ok'),
        ],
      };
    }
  }
}

// ---- idempotentlik (code_014) ---------------------------------------------------------------------------------

function idem(durum: IdemDurum, id: IstekId, l: Listing): Sonuc<IdemDurum> {
  const at = (sig: string, frag: string): number => lineOf(l, frag, lineOf(l, sig));
  const ev = (from: string, to: string, label: string, kind: Ev['kind'], satir: number, tone?: Ton): Ev => ({ from, to, label, kind, tone, satir });

  switch (id) {
    case 'stok-ayarla-5': {
      const sig = 'function stokuAyarla';
      return {
        durum: { ...durum, stok: 5 },
        olaylar: [
          ev('servis', 'veri', 'stok.mikroskop = 5', 'request', at(sig, 'stok.mikroskop = yeniDeger')),
          ev('veri', 'servis', 'stok 5', 'response', at(sig, 'stok.mikroskop = yeniDeger')),
        ],
      };
    }
    case 'stok-artir-1': {
      const sig = 'function stokuArtir';
      return {
        durum: { ...durum, stok: durum.stok + 1 },
        olaylar: [
          ev('servis', 'veri', 'stok.mikroskop += 1', 'request', at(sig, 'stok.mikroskop += artis')),
          ev('veri', 'servis', `stok ${durum.stok + 1}`, 'response', at(sig, 'stok.mikroskop += artis')),
        ],
      };
    }
    case 'delete-12': {
      const sig = 'function ekipmanSil';
      const var_ = durum.ekipmanlar.some(([k]) => k === 12);
      const sorgu = [
        ev('servis', 'veri', 'has(12)', 'request', at(sig, '!ekipmanlar.has')),
        ev('veri', 'servis', String(var_), 'response', at(sig, '!ekipmanlar.has')),
      ];
      if (!var_) {
        return {
          durum,
          kod: 404,
          govde: json({ hataKodu: 'EKIPMAN_BULUNAMADI' }),
          olaylar: [...sorgu, ev('servis', 'rota', 'durumKodu 404', 'response', at(sig, 'durumKodu: 404'), 'alarm')],
        };
      }
      return {
        durum: { ...durum, ekipmanlar: durum.ekipmanlar.filter(([k]) => k !== 12) },
        kod: 204,
        govde: null,
        olaylar: [
          ...sorgu,
          ev('servis', 'veri', 'delete(12)', 'request', at(sig, 'ekipmanlar.delete')),
          ev('servis', 'rota', 'durumKodu 204', 'response', at(sig, 'durumKodu: 204'), 'ok'),
        ],
      };
    }
    default: {
      // post-anahtar-7 / post-anahtar-9
      const ekipmanKimligi = id === 'post-anahtar-9' ? 9 : 7;
      const ogrenci = 'Elif';
      const anahtar = 'rzv-7f3a';
      const sig = 'function rezervasyonOlustur';
      const parmakIzi = JSON.stringify({ ekipmanKimligi, ogrenci });
      const onceki = durum.anahtarlar.find(([a]) => a === anahtar)?.[1];
      const sorgu = [
        ev('servis', 'veri', `islenmisAnahtarlar.get("${anahtar}")`, 'request', at(sig, 'islenmisAnahtarlar.get')),
        ev('veri', 'servis', onceki ? 'onceki' : 'undefined', 'response', at(sig, 'islenmisAnahtarlar.get')),
      ];
      if (onceki) {
        const ayni = onceki.parmakIzi === parmakIzi;
        const kontrol = ev('servis', 'servis', 'onceki.parmakIzi !== parmakIzi', 'note', at(sig, 'onceki.parmakIzi !== parmakIzi'), ayni ? 'ok' : 'alarm');
        if (!ayni) {
          return {
            durum,
            kod: 422,
            govde: json({ hataKodu: 'ANAHTAR_FARKLI_GOVDE' }),
            olaylar: [...sorgu, kontrol, ev('servis', 'rota', 'durumKodu 422', 'response', at(sig, 'durumKodu: 422'), 'alarm')],
          };
        }
        const kimlik = (JSON.parse(onceki.govde) as Rezervasyon).kimlik;
        return {
          durum,
          kod: onceki.durumKodu,
          govde: onceki.govde,
          location: onceki.durumKodu === 201 ? `/api/rezervasyonlar/${kimlik}` : undefined,
          olaylar: [...sorgu, kontrol, ev('servis', 'rota', `durumKodu ${onceki.durumKodu} (ilk yanıt)`, 'response', at(sig, 'return onceki.yanit'), 'ok')],
        };
      }
      const yeni: Rezervasyon = { kimlik: durum.rezervasyonlar.length + 1, ekipmanKimligi, ogrenci };
      const govde = json(yeni);
      return {
        durum: {
          ...durum,
          rezervasyonlar: [...durum.rezervasyonlar, yeni],
          anahtarlar: [...durum.anahtarlar, [anahtar, { parmakIzi, durumKodu: 201, govde }]],
        },
        kod: 201,
        govde,
        location: `/api/rezervasyonlar/${yeni.kimlik}`,
        olaylar: [
          ...sorgu,
          ev('servis', 'veri', 'rezervasyonlar.push(yeni)', 'request', at(sig, 'rezervasyonlar.push')),
          ev('servis', 'veri', `islenmisAnahtarlar.set("${anahtar}", …)`, 'request', at(sig, 'islenmisAnahtarlar.set')),
          ev('servis', 'rota', 'durumKodu 201', 'response', at(sig, 'durumKodu: 201, govde: yeni'), 'ok'),
        ],
      };
    }
  }
}

// ---- dispatch -------------------------------------------------------------------------------------------------

/** One send. Unknown ids (or ids of the other program) fall back to the program's first request. */
export function gonder(program: ProgramId, durum: LabDurum | IdemDurum, istekId: string): { durum: LabDurum | IdemDurum; gonderim: Gonderim } {
  const liste = ISTEKLER[program];
  const tanim: IstekTanimi = liste.find((t) => t.id === istekId) ?? liste[0];
  const l = listing(LISTINGS, program);
  const s: Sonuc<LabDurum | IdemDurum> =
    program === 'laboratuvar-api' ? lab(durum as LabDurum, tanim.id, l) : idem(durum as IdemDurum, tanim.id, l);

  const istek = tanim.istek;
  const ana = program === 'laboratuvar-api' ? 'laboratuvarApi.' : '';
  // idempotentlik: the call text itself (the bare name would hit the function definition first)
  const cagriSatiri =
    program === 'laboratuvar-api' ? lineOf(l, `${ana}${tanim.cagri.slice(0, tanim.cagri.indexOf('('))}`) : lineOf(l, tanim.cagri);
  const imza = lineOf(l, `${program === 'laboratuvar-api' ? '' : 'function '}${tanim.cagri.slice(0, tanim.cagri.indexOf('('))}(`);
  const evler: Ev[] = [];
  let yanit: HttpYanit | undefined;
  if (istek) {
    evler.push({ from: 'istemci', to: 'rota', label: `${istek.metot} ${istek.yol}`, kind: 'request', satir: cagriSatiri });
    evler.push({ from: 'rota', to: 'servis', label: tanim.cagri, kind: 'request', satir: imza });
  }
  evler.push(...s.olaylar);
  if (istek && s.kod !== undefined) {
    const metin = DURUM_METNI[s.kod];
    const govde = s.govde === null ? null : typeof s.govde === 'string' ? s.govde : json(s.govde);
    yanit = {
      durumKodu: s.kod,
      durumMetni: metin,
      govde,
      ...(s.kod === 201 && s.location ? { basliklar: [['Location', s.location]] as [string, string][] } : {}),
    };
    evler.push({ from: 'rota', to: 'istemci', label: `${s.kod} ${metin}`, kind: 'response', tone: ok(s.kod), satir: cagriSatiri });
  }
  const olaylar: Message[] = evler.map((e, i) => ({
    id: `e${i + 1}`,
    from: e.from,
    to: e.to,
    label: e.label,
    kind: e.kind,
    ...(e.tone ? { tone: e.tone } : {}),
  }));
  return {
    durum: s.durum,
    gonderim: {
      istekId: tanim.id,
      ...(istek ? { istek } : {}),
      ...(yanit ? { yanit } : {}),
      cagri: tanim.cagri,
      olaylar,
      satirlar: evler.map((e) => e.satir),
      cikti: s.yaniti !== undefined ? nodeInspect(s.yaniti).split('\n') : [],
    },
  };
}

export function calistirSira(program: ProgramId, sira: readonly IstekId[]): { durumlar: (LabDurum | IdemDurum)[]; gonderimler: Gonderim[] } {
  let durum: LabDurum | IdemDurum = program === 'laboratuvar-api' ? LAB_BASLANGIC : IDEM_BASLANGIC;
  const durumlar: (LabDurum | IdemDurum)[] = [];
  const gonderimler: Gonderim[] = [];
  for (const id of sira) {
    const r = gonder(program, durum, id);
    durum = r.durum;
    durumlar.push(durum);
    gonderimler.push(r.gonderim);
  }
  return { durumlar, gonderimler };
}

/**
 * The terminal lines the book program (code_014) prints for a request order. code_014 calls each stock function
 * exactly twice and prints the literal "iki kez"; a Lab run that calls it once or three times gets a line marked as
 * this page's own summary instead, since the book's code cannot print it.
 */
export function idemTerminal(sira: readonly IstekId[], gonderimler: readonly Gonderim[]): string[] {
  const { durumlar } = calistirSira('idempotentlik', sira);
  const satirlar: string[] = [];
  const postKodlari: number[] = [];
  let silme = 0;
  let grup = 0;
  for (let i = 0; i < sira.length; i++) {
    const id = sira[i];
    const d = durumlar[i] as IdemDurum;
    grup = i > 0 && sira[i - 1] === id ? grup + 1 : 1;
    const sonMu = sira[i + 1] !== id;
    if (id === 'stok-ayarla-5' && sonMu) satirlar.push(grup === 2 ? `Mutlak atama iki kez: ${d.stok}` : `// sayfa özeti: stokuAyarla(5) ${grup} kez, stok: ${d.stok}`);
    else if (id === 'stok-artir-1' && sonMu) satirlar.push(grup === 2 ? `Göreli artış iki kez: ${d.stok}` : `// sayfa özeti: stokuArtir(1) ${grup} kez, stok: ${d.stok}`);
    else if (id === 'delete-12') satirlar.push(`DELETE ${++silme}: ${gonderimler[i]?.yanit?.durumKodu} kalan: ${d.ekipmanlar.length}`);
    else if (id === 'post-anahtar-7' || id === 'post-anahtar-9') postKodlari.push(gonderimler[i]?.yanit?.durumKodu ?? 0);
  }
  if (postKodlari.length > 0) {
    const son = durumlar[durumlar.length - 1] as IdemDurum;
    satirlar.push(`POST yanıtları: ${postKodlari.join(' ')}`, `Oluşan rezervasyon sayısı: ${son.rezervasyonlar.length}`);
  }
  return satirlar;
}
