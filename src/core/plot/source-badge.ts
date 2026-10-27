import './source-badge.css';

export type KaynakTuru = 'kitap' | 'kitap-kodu' | 'kitaba-dayali' | 'standart';
export interface Rozet {
  tur: KaynakTuru;
  ref?: string;
}

const METIN: Record<KaynakTuru, string> = {
  kitap: 'Kitabın çıktısı',
  'kitap-kodu': 'Kitabın kodu, yeni girdi',
  'kitaba-dayali': 'Kitabın cümlesine dayalı örnek',
  standart: 'Standarttan · kitapta kodu yok',
};
const ACIKLAMA: Record<KaynakTuru, string> = {
  kitap: 'Bu çıktı kitapta aynen yazılıdır.',
  'kitap-kodu': 'Kod kitaptan; ekrandaki sonuç o kodun bu sayfada çalışmasından gelir: girdi yeni ya da kitabın yazdırmadığı bir ara adımdır.',
  'kitaba-dayali': 'Kitap bu durumu cümleyle anlatır; örneğin kendisi bu sayfaya aittir.',
  standart: 'Bu davranış kitabın kodunda yok; tarayıcı ya da paket standardından gelir.',
};

/** A small label saying where an on-screen text comes from (the book's output, the book's code, or an example). */
export function sourceBadge(doc: Document, tur: KaynakTuru, ref?: string): HTMLSpanElement {
  const s = doc.createElement('span');
  s.className = `kaynak-rozeti kaynak-${tur}`;
  s.textContent = ref ? `${METIN[tur]} · ${ref}` : METIN[tur];
  s.title = ACIKLAMA[tur];
  return s;
}
