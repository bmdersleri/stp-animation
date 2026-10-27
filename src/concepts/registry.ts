export interface ConceptEntry {
  id: string;
  chapter: number;
  chapterTitle: string;
  title: string;
  status: 'hazir' | 'yakinda';
  href?: string;
}

const CH: Record<number, string> = {
  1: 'Modern Backend Programlamaya Giriş ve Web Mimarisi',
  2: 'Backend için Modern JavaScript Temelleri',
  3: 'TypeScript ile Güvenli Backend Kodlama',
  4: 'Node.js Runtime, npm ve Sunucu Tarafı Programlama',
  5: 'Express ile Web Sunucusu ve Routing',
  6: 'HTTP ve RESTful API Tasarımı',
  7: 'PostgreSQL ve SQL ile Kalıcı Veri Yönetimi',
  8: 'Prisma ORM ve Veri Erişim Katmanı',
  9: 'Katmanlı Backend Mimarisi ve Uygulama Tasarımı',
  10: 'Kimlik Doğrulama ve Yetkilendirme',
  11: 'Güvenli Backend: Validation, Middleware ve Hata Yönetimi',
  12: 'Dosya İşlemleri, E-posta ve Harici API Entegrasyonu',
  13: 'OpenAPI Dokümantasyonu ve Backend Testleri',
  14: 'Docker ile Backend Uygulamalarını Konteynerleştirme',
  15: 'Linux Sunucuya Yayınlama: Nginx, HTTPS ve Operasyon',
  16: 'IoT Sistemleri için Backend Geliştirme',
  17: "Yapay Zekâ ve ML Servislerinin Backend'e Entegrasyonu",
  18: 'Capstone: Üniversite Laboratuvar Yönetim Sistemi',
};

/** Placeholder for a page that is planned but not built yet. */
export function soon(id: string, chapter: number, title: string): ConceptEntry {
  return { id, chapter, chapterTitle: CH[chapter], title, status: 'yakinda' };
}

export const concepts: ConceptEntry[] = [
  {
    id: 'istek-yanit',
    chapter: 1,
    chapterTitle: CH[1],
    title: "İstek-yanıt yolculuğu: istemciden backend'e",
    status: 'hazir',
    href: 'istek-yanit/',
  },
  {
    id: 'event-loop',
    chapter: 4,
    chapterTitle: CH[4],
    title: 'Event loop: çağrı yığını ve kuyruklar',
    status: 'hazir',
    href: 'event-loop/',
  },
  soon('middleware-zinciri', 5, 'Middleware zinciri: istek işlem hattı'),
  soon('rest-crud', 6, 'CRUD, HTTP metotları ve durum kodları'),
  soon('sql-join', 7, 'JOIN ile tabloları birleştirme'),
  soon('katmanli-mimari', 9, 'Katmanlı mimari: controller, service, repository'),
  soon('salt-hash', 10, 'Parola güvenliği: salt ve hashing'),
  soon('jwt-akisi', 10, 'JWT ile kimlik doğrulama akışı'),
  soon('rbac-401-403', 10, 'RBAC ve 401 ile 403 ayrımı'),
  soon('cors-preflight', 11, 'CORS ve preflight isteği'),
  soon('rate-limiting', 11, 'Rate limiting: istek sınırlama'),
  soon('docker-compose', 14, 'Docker Compose ile çok servisli ortam'),
  soon('nginx-tls', 15, 'Nginx reverse proxy ve HTTPS/TLS'),
  soon('iot-zaman-serisi', 16, 'IoT: sensör verisi ve zaman serisi'),
  soon('timeout-retry', 17, 'Timeout, retry ve hata izolasyonu'),
];
