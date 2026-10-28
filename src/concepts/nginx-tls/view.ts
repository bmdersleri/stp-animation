import { listing, type Listing } from '../../core/listing';
import type { CheckListSpec, Denetim } from '../../core/plot/check-list';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec } from '../../core/plot/data-table';
import type { HttpCardsSpec } from '../../core/plot/http-cards';
import type { KitapBlok } from '../../core/plot/kitap-blok';
import type { Message, SequenceSpec } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import type { SegmentStripSpec } from '../../core/plot/segment-strip';
import { istekIsle, LISTINGS, dogruIstemciIpAl, sertifikaDurumu, type NginxIzi } from './proxy';
import type { NginxTlsParams } from './scenario';

export interface NginxView {
  /** The book block of the intro and summary steps; null on every other step. */
  kitap: KitapBlok | null;
  sequence: SequenceSpec | null;
  kartlar: HttpCardsSpec;
  /** Why the request got no answer (the card then shows no response); null when it did. */
  yanitYok: string | null;
  denetim: CheckListSpec | null;
  /** What the application sees (P2); null on 301, on no response and on a 502. */
  gorulen: DataTableSpec | null;
  xff: SegmentStripSpec | null;
  sertifika: DataTableSpec | null;
  certbot: CheckListSpec | null;
  notlar: readonly string[];
  code: CodeTraceSpec;
}

const L = (id: string): Listing => listing(LISTINGS, id);
const K2 = L('kod-15-2');
const K3 = L('kod-15-3');
const K4 = L('code-004');
const K4_CIKTI = L('code-004-cikti').lines;
const K5 = L('kod-15-5');
const K7 = L('code-007');
const K6 = L('kod-15-6');

/** Index (1-based, within the listing) of book line `satir`. */
const kitapSatiri = (l: Listing, satir: number): number => satir - l.satirlar[0] + 1;
const kodSeridi = (l: Listing, kitapSatirlari: readonly number[]): CodeTraceSpec =>
  ({ title: l.title, lines: l.lines, active: kitapSatirlari.map((s) => kitapSatiri(l, s)) });

/** The book's sentences, verbatim without code ticks, bold marks and emoji (final.md line in the comment). */
const TANIM = 'Reverse proxy, istemcilerden gelen HTTP(S) isteklerini karşılayıp arka planda çalışan bir veya birden fazla uygulama sunucusuna yönlendiren; yanıtı da aynı şekilde istemciye ileten bir ara katmandır. Nginx, bu amaçla en yaygın kullanılan sunuculardan biridir.'; // L259
const PARAGRAF = "Production ortamında istek, uygulamaya doğrudan ulaşmaz; önce Nginx'e gelir, oradan yerel ağ arayüzü üzerinden Node.js sürecine iletilir. Aşağıdaki sıra diyagramı bu yolu, systemd biriminin docker compose çağrısıyla servisi ayağa kaldırmasını ve uygulama çöktüğünde container restart politikasının devreye girmesini gösterir."; // L266
const YEREL_NOT = 'Uygulamanın yalnızca 127.0.0.1 üzerinde dinlediğine dikkat ediniz: bu, 3000 portunun dışarıdan doğrudan erişilebilir olmasını engeller.'; // L278
const BAD_GATEWAY_NOT = '502 Bad Gateway yanıtı bu nedenle uygulama kodunda değil, Nginx tarafında üretilir; hata ayıklamaya systemctl status ile başlamak, Nginx günlüklerine bakmaktan daha hızlı sonuç verir.'; // L278
const BASLIK_NOTU = 'Dikkat noktası: Bu başlıklar eklenmezse uygulama tüm istekleri Nginx\'in kendi IP\'sinden geliyormuş gibi görür; bu da loglama, hız sınırlama ve IP tabanlı güvenlik kararlarını geçersiz kılar.'; // L321
const YONLENDIRME_NOTU = 'Dikkat noktası: 301 yönlendirmesi tarayıcılar tarafından agresif biçimde önbelleğe alınır; yanlış yapılandırılmış bir yönlendirme sonradan düzeltilse bile bazı istemcilerde uzun süre etkili kalabilir.'; // L482
const YAYGIN_HATA_NOTU = "Yaygın hatalar. En yaygın hata, HTTP'den HTTPS'e yönlendirmeyi unutup, kullanıcıların hâlâ şifresiz http:// adresinden erişebilmesine izin vermektir."; // L498
const SINAV_NOTU = "Sınav Notu: Nginx trafiği API'nin önünde karşılar ve yönlendirir; HTTPS bu trafiği şifreler; ortam değişkenleri sırları koddan ayırır; health check ise servisin gerçekten sağlıklı olup olmadığını, yalnızca ayakta olup olmadığından ayırt eder."; // L959
/** R18: Nginx's default `Host`, which the 443 block of Kod 15.5 leaves as it is. The page's own sentence: the scene styles it apart. */
export const VARSAYILAN_NOTU = "Nginx varsayılanı: Host = $proxy_host (127.0.0.1:3000); Kod 15.5'in 443 bloğu yalnız X-Forwarded-Proto ekler.";

const SUTUNLAR = ['Yaklaşım', 'Avantajı', 'Dezavantajı', 'Uygun kullanım'].map((ad) => ({ ad }));
const ALTERNATIFLER_TRAFIK: DataTableSpec = {
  baslik: 'Alternatifler', // L328
  sutunlar: SUTUNLAR,
  satirlar: [ // L332-335
    { key: 'nginx', cells: ['Nginx reverse proxy (bu bölümde örneklenen)', 'Olgun, geniş topluluk desteği, HTTPS sonlandırma', 'Yapılandırma sözdizimi öğrenme gerektirir', 'Çoğu production web/API dağıtımı'] },
    { key: 'dogrudan', cells: ["API'yi doğrudan dış dünyaya açma", 'En basit kurulum', 'HTTPS, yük dengeleme, statik dosya sunma elle yönetilmelidir', 'Yalnızca geliştirme/test ortamı'] },
    { key: 'yuk-dengeleyici', cells: ['Bulut sağlayıcı yük dengeleyicisi (managed load balancer)', 'Sağlayıcı tarafından yönetilir, otomatik ölçekler', 'Maliyet ve platforma bağımlılık', 'Büyük ölçekli, bulut-yerel (cloud-native) dağıtımlar'] },
    { key: 'caddy', cells: ['Caddy sunucusu', 'HTTPS sertifikasını otomatik alıp yeniler, daha az yapılandırma gerektirir', "Nginx'e göre daha küçük topluluk ve modül ekosistemi", 'Basit yapılandırmalı, hızlı kurulum istenen küçük/orta projeler'] },
  ],
};
const ALTERNATIFLER_SERTIFIKA: DataTableSpec = {
  baslik: 'Alternatifler', // L489
  sutunlar: SUTUNLAR,
  satirlar: [ // L493-496
    { key: 'letsencrypt', cells: ["Let's Encrypt + certbot (bu bölümde örneklenen)", 'Ücretsiz, otomatik yenilenebilir', 'Alan adı sahipliği doğrulaması gerektirir', 'Çoğu üniversite/kurum projesi'] },
    { key: 'ticari', cells: ['Kurumsal/ticari sertifika sağlayıcı', 'Genişletilmiş doğrulama (EV) seçenekleri sunar', 'Ücretlidir', 'Kurumsal marka güveni gereken siteler'] },
    { key: 'bulut', cells: ['Bulut sağlayıcının yönetilen sertifikası', 'Sağlayıcı tarafından otomatik yönetilir', 'Yalnızca o bulut platformunda çalışır', 'Tamamen bulut-yerel dağıtımlar'] },
    { key: 'self-signed', cells: ['Kendinden imzalı (self-signed) sertifika', 'Kurulumu anlık ve ücretsizdir', 'Tarayıcılar güvenilmez uyarısı gösterir, herkese açık sitelerde kullanılamaz', 'Yalnızca iç test/geliştirme ortamları'] },
  ],
};

const TANITIM_BLOK: KitapBlok = { tanim: TANIM, paragraflar: [PARAGRAF], tablolar: [], notlar: [BAD_GATEWAY_NOT, YEREL_NOT] };
const OZET_BLOK: KitapBlok = { tablolar: [ALTERNATIFLER_TRAFIK, ALTERNATIFLER_SERTIFIKA], notlar: [SINAV_NOTU] };

const YENILEME_ESIGI = '30 gün';
const SERIT_LANES = [
  { id: 'istemci', label: ['İstemci'] }, { id: 'ufw', label: ['UFW'] },
  { id: 'nginx', label: ['Nginx'] }, { id: 'uygulama', label: ['Uygulama'] },
];

const bosKartlar: HttpCardsSpec = { yanitlar: [], terminal: [] };

const bos = (code: CodeTraceSpec, kitap: KitapBlok | null = null): NginxView => ({
  kitap, sequence: null, kartlar: bosKartlar, yanitYok: null, denetim: null, gorulen: null,
  xff: null, sertifika: null, certbot: null, notlar: [], code,
});

const sira = (messages: Message[], ariaLabel: string, stopAt?: string): SequenceSpec =>
  ({ lanes: SERIT_LANES, messages, ariaLabel, ...(stopAt ? { stopAt } : {}) });

function sertifikaTablosu(kalanGun: number): DataTableSpec {
  return {
    baslik: 'Sertifika',
    sutunlar: ['kalan gün', 'durum', 'yenileme eşiği'].map((ad) => ({ ad })),
    satirlar: [{ key: 'sertifika', cells: [kalanGun, sertifikaDurumu(kalanGun), YENILEME_ESIGI] }],
  };
}

/** P10: the renewal row follows the certificate; the first two rows always pass. */
function certbotListesi(kalanGun: number): CheckListSpec {
  const durum = sertifikaDurumu(kalanGun);
  const yenileme: Denetim = durum === 'gecerli'
    ? { ad: 'Otomatik Yenileme', durum: 'gecti', ayrinti: `kalan ${kalanGun} gün` }
    : durum === 'yenilenecek'
      ? { ad: 'Otomatik Yenileme', durum: 'bekliyor', ayrinti: 'kalan < 30 gün: yenilenecek' }
      : { ad: 'Otomatik Yenileme', durum: 'kaldi', ayrinti: 'sertifika süresi dolmuş' };
  return {
    baslik: 'Certbot',
    denetimler: [
      { ad: 'HTTP-01 Challenge', durum: 'gecti', ayrinti: 'alan adı sahipliği doğrulandı' },
      { ad: 'Sertifika Enjeksiyonu', durum: 'gecti', ayrinti: 'sertifika Nginx ayarına eklendi' },
      yenileme,
    ],
  };
}

/** The request sequence of the three-request UFW stage (P7): the first two messages of each request. */
function ufwSirasi(p: NginxTlsParams): SequenceSpec {
  const mesajlar: Message[] = [];
  for (const hedef of ['https-443', 'port-3000', 'port-5432'] as const) {
    const port = hedef.split('-')[1];
    istekIsle({ ...p, hedef }).olaylar.slice(0, 2).forEach((m) => mesajlar.push({ ...m, id: `${port}-${m.id}` }));
  }
  return sira(mesajlar, 'UFW güvenlik duvarı sıra diyagramı', 'ufw');
}

/** The book line that decides a request (Lab), or the step's own focus (Ders, `kitapCiktisi`). */
function akisKodu(p: NginxTlsParams, iz: NginxIzi, kitapCiktisi: boolean): CodeTraceSpec {
  if (iz.denetimler[0].durum === 'kaldi') return kodSeridi(K2, [215]);
  const kapali = p.uygulama === 'kapali';
  const dolu = p.kalanGun <= 0;
  const var443 = p.hedef === 'https-443';
  // R18: code-007 is its own port-80 block plus Kod 15.5's 443 block
  if (p.ayar === 'kod-15-5' || (p.ayar === 'code-007' && var443)) {
    if (!var443) return kodSeridi(K5, [456]);
    if (dolu) return kodSeridi(K5, [463]);
    return kodSeridi(K5, kitapCiktisi && !kapali ? [460, 463, 464, 468] : [467]);
  }
  if (p.ayar === 'code-007') return kodSeridi(K7, [514]);
  if (var443) return kodSeridi(K3, [299]); // only a `listen 80` block exists
  if (kitapCiktisi && p.ayar === 'basliksiz') return kodSeridi(K4, [351]);
  if (kitapCiktisi && p.sahteXff) return kodSeridi(K4, [360]);
  return kodSeridi(K3, kitapCiktisi && p.ayar === 'kod-15-3' ? [303, 304, 305, 306, 307] : [303]);
}

function xffSeridi(gorulen: [string, string][] | null): SegmentStripSpec | null {
  const deger = gorulen?.find(([a]) => a === 'X-Forwarded-For')?.[1];
  const parcalar = deger?.split(', ');
  if (!parcalar || parcalar.length !== 2) return null;
  return {
    baslik: 'X-Forwarded-For',
    parcalar: [
      { metin: parcalar[0], etiket: 'istemcinin gönderdiği', ton: 3 },
      { metin: parcalar[1], etiket: "Nginx'in eklediği", ton: 1 },
    ],
    ayirici: ', ',
  };
}

function akisGorunumu(p: NginxTlsParams, kitapCiktisi: boolean): NginxView {
  const iz = istekIsle(p);
  const gorulen: DataTableSpec | null = iz.uygulamaGorur
    ? { baslik: 'Uygulamanın gördüğü', sutunlar: [{ ad: 'alan' }, { ad: 'değer' }], satirlar: iz.uygulamaGorur.map(([a, d]) => ({ key: a, cells: [a, d] })) }
    : null;
  const notlar: string[] = [];
  if (p.ayar === 'basliksiz' && gorulen) notlar.push(BASLIK_NOTU);
  if (iz.yanit?.durumKodu === 301) notlar.push(YONLENDIRME_NOTU, YAYGIN_HATA_NOTU);
  if (p.hedef === 'https-443' && gorulen) notlar.push(VARSAYILAN_NOTU);
  // the certificate pieces belong to step 9 in Ders; the Lab shows them with every https request
  const tls = p.hedef === 'https-443' && !kitapCiktisi;
  return {
    kitap: null,
    sequence: sira(iz.olaylar, 'İstek sıra diyagramı', iz.denetimler[0].durum === 'kaldi' ? 'ufw' : undefined),
    kartlar: { istek: iz.istek, yanitlar: iz.yanit ? [iz.yanit] : [], terminal: [] },
    yanitYok: iz.yanitYok ?? null,
    denetim: { baslik: 'İstek yolu', denetimler: iz.denetimler },
    gorulen,
    xff: xffSeridi(iz.uygulamaGorur),
    sertifika: tls ? sertifikaTablosu(p.kalanGun) : null,
    certbot: tls ? certbotListesi(p.kalanGun) : null,
    notlar,
    code: akisKodu(p, iz, kitapCiktisi),
  };
}

/** Everything the scene draws for one parameter set; no DOM. `kitapCiktisi` is true in Ders and false in Lab. */
export function deriveNginxView(p: NginxTlsParams, kitapCiktisi = false): NginxView {
  switch (p.asama) {
    case 'tanitim': return bos(kodSeridi(K3, []), TANITIM_BLOK);
    case 'ozet': return bos(kodSeridi(K3, []), OZET_BLOK);
    case 'ufw': {
      const iz = istekIsle({ ...p, hedef: 'port-5432' });
      return {
        ...bos(kodSeridi(K2, kitapCiktisi ? [215, 219, 220, 221] : [215])),
        sequence: ufwSirasi(p),
        kartlar: { istek: iz.istek, yanitlar: [], terminal: [] },
        yanitYok: iz.yanitYok ?? null,
        denetim: { baslik: 'İstek yolu', denetimler: iz.denetimler },
      };
    }
    case 'xff': {
      const girdi = '203.0.113.7, 10.0.0.5'; // L363
      const istemci = dogruIstemciIpAl(girdi, '10.0.0.5');
      return {
        ...bos(kodSeridi(K4, [360])),
        xff: {
          baslik: 'X-Forwarded-For',
          parcalar: [
            { metin: istemci, ton: 1, fark: [...istemci].map((_, i) => i) },
            { metin: '10.0.0.5' },
          ],
          ayirici: ', ',
        },
        kartlar: { yanitlar: [], terminal: [{ metin: K4_CIKTI[0] }] },
      };
    }
    case 'certbot':
      return { ...bos(kodSeridi(K6, [548, 549, 550, 551, 552, 553])), sertifika: sertifikaTablosu(p.kalanGun), certbot: certbotListesi(p.kalanGun) };
    case 'akis':
      return akisGorunumu(p, kitapCiktisi);
  }
}

/** Always the book's code on the reader's own settings. */
export function nginxLabRozet(_p: NginxTlsParams): Rozet {
  return { tur: 'kitap-kodu' };
}
