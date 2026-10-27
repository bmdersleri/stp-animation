import type { TerminalSatir } from '../../core/plot/http-cards';

/** Pure model of Express's synchronous dispatch (spec Bölüm 2, rules 1-8); real Express order, not the book's figure 5.2. */
export interface SimYanit {
  status(kod: number): SimYanit;
  json(govde: unknown): void;
  send(govde: string): void;
  readonly headersSent: boolean;
}

export interface Istek {
  metot: 'GET' | 'POST';
  yol: string;
  basliklar: Record<string, string>;
}

export interface Ctx {
  istek: Istek;
  yanit: SimYanit;
  next(err?: Error): void;
  log(metin: string): void;
  error(metin: string): void;
  /** Sets the listing line of the next event this function causes. */
  at(satir: number): void;
  /** Set while an error layer runs. */
  hata?: Error;
}

export type Fn = { ad: string; arity: 3 | 4; satir: number; govde: (c: Ctx) => void };
export type Katman =
  | { tur: 'use'; fn: Fn }
  | { tur: 'route'; metot: 'GET' | 'POST'; yol: string; fns: Fn[] };

export interface Olay {
  tur: 'gir' | 'next' | 'log' | 'yanit' | 'hata' | 'atla' | 'askida';
  /** Fn.ad of the layer function (lane id); 'varsayilan' for Express's own final handler. */
  katman: string;
  /** Line in the listing the layer belongs to; 0 for the final handler (no listing line). */
  satir: number;
  metin?: string;
}

export interface Iz {
  olaylar: Olay[];
  yanit?: { durumKodu: number; govde: string };
  terminal: (TerminalSatir & { olay: number })[];
  askida: boolean;
}

export const OLAY_SINIRI = 50;
export const HEADERS_SENT = 'Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client';
export const VARSAYILAN = 'varsayilan';

export function dispatch(app: readonly Katman[], istek: Istek): Iz {
  const iz: Iz = { olaylar: [], terminal: [], askida: false };
  let gonderildi = false;
  let kod = 200;

  const olayEkle = (o: Olay): number => {
    if (iz.olaylar.length >= OLAY_SINIRI) throw new Error('dispatch: olay sınırı');
    iz.olaylar.push(o);
    return iz.olaylar.length - 1;
  };
  const satirEkle = (olay: number, metin: string, akis: 'stdout' | 'stderr'): void => {
    iz.terminal.push({ metin, akis, olay });
  };
  let aktif: { ad: string; satir: () => number } = { ad: VARSAYILAN, satir: () => 0 };
  const yanitla = (govde: string): void => {
    gonderildi = true;
    iz.yanit = { durumKodu: kod, govde };
    olayEkle({ tur: 'yanit', katman: aktif.ad, satir: aktif.satir(), metin: govde });
  };
  const yanit: SimYanit = {
    status(k) {
      if (gonderildi) throw new Error(HEADERS_SENT);
      kod = k;
      return yanit;
    },
    json(g) {
      if (gonderildi) throw new Error(HEADERS_SENT);
      yanitla(JSON.stringify(g));
    },
    send(g) {
      if (gonderildi) throw new Error(HEADERS_SENT);
      yanitla(g);
    },
    get headersSent() {
      return gonderildi;
    },
  };

  let hata: Error | undefined;
  let li = 0;
  let fi = 0;

  while (li < app.length) {
    const k = app[li];
    const fns = k.tur === 'use' ? [k.fn] : k.fns;
    const esles = k.tur === 'use' || (k.metot === istek.metot && k.yol === istek.yol);
    const fn = fns[fi];
    const hataKatmani = fn.arity === 4;
    if (!esles || (hata ? !hataKatmani : hataKatmani)) {
      // Whole non-running layer: one 'atla' per function.
      for (let i = fi; i < fns.length; i++) olayEkle({ tur: 'atla', katman: fns[i].ad, satir: fns[i].satir });
      li++;
      fi = 0;
      continue;
    }

    olayEkle({ tur: 'gir', katman: fn.ad, satir: fn.satir });
    let sonSatir: number | undefined;
    let siradaki: number | undefined;
    let sonraki = false;
    let sonrakiHata: Error | undefined;
    const satir = (): number => {
      const s = siradaki ?? fn.satir;
      siradaki = undefined;
      return s;
    };
    const c: Ctx = {
      istek,
      yanit,
      hata,
      next(err) {
        if (sonraki) return;
        sonraki = true;
        if (err) {
          sonrakiHata = err;
          olayEkle({ tur: 'hata', katman: fn.ad, satir: satir(), metin: err.message });
        } else olayEkle({ tur: 'next', katman: fn.ad, satir: satir() });
      },
      log(metin) {
        satirEkle(olayEkle({ tur: 'log', katman: fn.ad, satir: satir(), metin }), metin, 'stdout');
      },
      error(metin) {
        satirEkle(olayEkle({ tur: 'log', katman: fn.ad, satir: satir(), metin }), metin, 'stderr');
      },
      at(s) {
        siradaki = s;
        sonSatir = s;
      },
    };
    // Entering an error layer consumes the error; next(err) or a throw sets it again.
    hata = undefined;
    aktif = { ad: fn.ad, satir };
    let firlatilan: Error | undefined;
    try {
      fn.govde(c);
    } catch (e) {
      firlatilan = e instanceof Error ? e : new Error(String(e));
    }

    if (firlatilan) {
      // A throw (like next(err) below) leaves the rest of this layer's route functions unrun without 'atla' events:
      // no page shows a multi-function route that throws, so only whole skipped layers are drawn as skipped.
      olayEkle({ tur: 'hata', katman: fn.ad, satir: satir(), metin: firlatilan.message });
      hata = firlatilan;
      li++;
      fi = 0;
    } else if (sonraki) {
      if (sonrakiHata) {
        hata = sonrakiHata;
        li++;
        fi = 0;
      } else if (fi + 1 < fns.length) fi++;
      else {
        li++;
        fi = 0;
      }
    } else if (gonderildi) {
      return iz;
    } else {
      olayEkle({ tur: 'askida', katman: fn.ad, satir: sonSatir ?? fn.satir });
      iz.askida = true;
      return iz;
    }
  }

  // End of the stack: Express's final handler.
  if (hata) {
    if (gonderildi) {
      satirEkle(olayEkle({ tur: 'log', katman: VARSAYILAN, satir: 0, metin: HEADERS_SENT }), HEADERS_SENT, 'stderr');
    } else {
      iz.yanit = { durumKodu: 500, govde: 'Internal Server Error' };
      const metin = `Error: ${hata.message}`;
      satirEkle(olayEkle({ tur: 'yanit', katman: VARSAYILAN, satir: 0, metin: iz.yanit.govde }), metin, 'stderr');
    }
  } else if (!gonderildi) {
    iz.yanit = { durumKodu: 404, govde: `Cannot ${istek.metot} ${istek.yol}` };
    olayEkle({ tur: 'yanit', katman: VARSAYILAN, satir: 0, metin: iz.yanit.govde });
  }
  return iz;
}
