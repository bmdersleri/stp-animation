import type { Scenario } from '../../core/player';
import { framesOf, type ProgramId } from './programs';
import type { Frame } from './sim';

/** Parameters of the event-loop page: the program, the frame shown (`kare`) and the board or the phases view. */
export interface LoopParams { program: ProgramId; kare: number; gorunum: 'tahta' | 'asamalar' }

/** Index of the first frame of `id` matching `pred`; throws when none does. */
export function findFrame(id: ProgramId, pred: (f: Frame) => boolean): number {
  const i = framesOf(id).findIndex(pred);
  if (i < 0) throw new Error(`event-loop: ${id} has no such frame`);
  return i;
}

const last = (id: ProgramId): number => framesOf(id).length - 1;

/** The step scenario of the event-loop page (Ders steps 1-11). */
export const loopScenario: Scenario<LoopParams> = {
  defaults: { program: 'kod-4-4', kare: 0, gorunum: 'tahta' },
  steps: [
    {
      id: 'tanitim',
      title: 'Tek iş parçacığı, bekleyen işler',
      term: 'tek iş parçacığı',
      text: 'Event loop, Node.js’in olayları ve tamamlanan asenkron işleri uygun sırayla işleyen mekanizmasıdır. JavaScript kodunuz ana yürütme akışında çalışır; zamanlayıcı, ağ veya dosya işlemi gibi bekleyen işler tamamlandığında callback veya promise devamı kuyruğa alınır.',
      labText: 'Örnek kod henüz çalışmadı; yığın, zamanlayıcı kuyruğu ve çıktı boş. Kare çubuğunu ilerleterek programı satır satır izleyin.',
      params: { program: 'kod-4-4', kare: 0, gorunum: 'tahta' },
    },
    {
      id: 'senkron',
      title: 'Senkron satır hemen çalışır',
      term: 'ana çağrı yığını',
      text: 'İlk console.log hemen çalışır. Önce senkron satırlar çalışır; JavaScript kodunuz ana yürütme akışında çalışır.',
      labText: 'Yığında main görünür ve çıktıda ilk satır belirir. Başka bir kareye giderek yığının nasıl değiştiğine bakın.',
      params: { kare: findFrame('kod-4-4', (f) => f.output.length === 1) },
    },
    {
      id: 'zamanlayici',
      title: 'setTimeout callback’i kuyruğa kaydeder',
      term: 'zamanlayıcı kuyruğu',
      text: 'setTimeout çağrısı callback’i hemen çalıştırmaz; yalnızca en az 1000 ms sonra çalıştırılmak üzere event loop’un zamanlayıcı kuyruğuna kaydeder.',
      labText: 'Zamanlayıcı kuyruğunda callback bekliyor; saat henüz ilerlemedi. Callback’in kuyrukta ne zamana kadar kaldığına bakın.',
      params: { kare: findFrame('kod-4-4', (f) => f.timers.length === 1) },
    },
    {
      id: 'devam',
      title: 'Ana akış beklemeden devam eder',
      term: 'engellemeyen',
      text: 'İki console.log satırı senkron olduğu için, aralarında duran setTimeout’a rağmen sırayla hemen çalışır. Zamanlayıcı bekleme süresince programı durdurmaz.',
      labText: 'İkinci satır, callback hâlâ kuyruktayken çıktıya yazıldı. Kuyrukta bekleyen işin çıktıya karışmadığını görün.',
      params: { kare: findFrame('kod-4-4', (f) => f.output.length === 2) },
    },
    {
      id: 'callback',
      title: 'Yığın boşalınca callback çalışır',
      term: 'callback',
      text: 'Zamanlayıcı callback’i yalnızca ana çağrı yığını boşaldıktan ve süre dolduktan sonra çalıştırılır. Çıktıdaki sıralama kodun yazıldığı sıradan değil, senkron/asenkron ayrımından kaynaklanır.',
      labText: 'Saat zamanlayıcının süresine ulaştı, callback yığına çıkıp çalıştı ve çıktı tamamlandı. Başa dönüp sırayı yeniden izleyin.',
      params: { kare: last('kod-4-4') },
    },
    {
      id: 'sifir',
      title: 'Süre sıfır olsa da sıra değişmez',
      term: 'setTimeout(…, 0)',
      text: 'setTimeout(..., 0) yazılsa bile callback yine mevcut senkron kodun tamamlanmasını bekler. Bu yüzden önce "Bitti", sonra "Geç" yazılır; setTimeout işlemi kodu durdurmaz.',
      labText: 'Callback sıfır beklemeyle kaydedildi ama çıktıda yine sonda yer aldı. Hangi karede kuyruktan yığına geçtiğine bakın.',
      params: { program: 'bitti-gec', kare: last('bitti-gec') },
    },
    {
      id: 'await',
      title: 'await yalnızca devamı bekletir',
      term: 'async/await',
      text: 'await, yalnızca bu async fonksiyonun devamını bekletir; tüm Node.js programını kilitlemez. Bu nedenle son satırdaki "başka siparişler" mesajı önce görünür.',
      labText: 'await mutfagiYonet fonksiyonunu askıya aldı ve yığından çıkardı; yığında yalnızca main kaldı, çıktıda henüz tek satır var. Zamanlayıcıda bekleyen callback’e bakın, sonra kareleri ilerletip ana akışın sürdüğünü görün.',
      params: { program: 'kod-4-5', kare: findFrame('kod-4-5', (f) => f.note === 'await: fonksiyon askıya alındı') },
    },
    {
      id: 'cozuldu',
      title: 'Promise çözülünce devam sürer',
      term: 'Promise',
      text: 'siparisHazirla, gelecekte tamamlanacak bir Promise üretir. Süre dolup Promise çözülünce mutfagiYonet fonksiyonunun devamı çalışır ve "Sipariş hazır." mesajı yazılır.',
      labText: 'Promise çözüldü, fonksiyonun devamı çalıştı ve çıktının üç satırı da tamamlandı. Önceki kareye dönerek çözülmeden önceki durumu karşılaştırın.',
      params: { kare: last('kod-4-5') },
    },
    {
      id: 'mikro-once',
      title: 'Mikro görevler önce boşalır',
      term: 'mikro görev kuyruğu',
      text: 'Mikro görev kuyruğunun (Promise callback’leri) her zaman makro görev kuyruğundan (timer, G/Ç) önce boşaltılması, çalışma sırasını doğru tahmin etmenin anahtarıdır. Bu örnek kitabın cümlesine dayalıdır.',
      labText: 'Zamanlayıcı daha önce kaydedildi, ama Promise callback’i önce çalıştı. Kareleri gezerek hangi kuyruğun önce boşaldığını izleyin.',
      params: { program: 'mikro-makro', kare: last('mikro-makro') },
    },
    {
      id: 'asamalar',
      title: 'Bir turun beş aşaması',
      term: 'event loop aşamaları',
      text: 'Event loop’un bir turu timers, pending callbacks, poll, check ve close callbacks aşamalarından oluşur. Her aşama arasında önce process.nextTick, ardından Promise mikro görev kuyruğu boşaltılır. poll aşamasının kendine dönen oku, kuyruk boşken yeni bir olay gelene kadar burada beklendiğini anlatır.',
      labText: 'Beş aşama sırayla çember oluşturur ve poll aşaması vurgulanır. Notlar, aşamalar arasında mikro görevlerin ne zaman boşaltıldığını söyler.',
      params: { program: 'mikro-makro', kare: last('mikro-makro'), gorunum: 'asamalar' },
    },
    {
      id: 'engelleme',
      title: 'Uzun senkron kod her şeyi geciktirir',
      term: 'bloklama',
      text: 'Event loop sihirli değildir: CPU’yu uzun süre meşgul eden senkron kod, diğer callback’lerin çalışmasını geciktirir. Çok uzun süren CPU hesaplamalarında setTimeout kullanmak sorunu çözmez; işi küçük parçalara bölmek, worker thread kullanmak veya ayrı bir hizmete aktarmak değerlendirilmelidir.',
      labText: 'Döngü yığını tuttuğu sürece saat ilerledi ve zamanlayıcı callback’i planladığından geç çalıştı. Gecikme notunu ilgili karede arayın.',
      params: { program: 'engelleme', kare: last('engelleme'), gorunum: 'tahta' },
    },
  ],
};
