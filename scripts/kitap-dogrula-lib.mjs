/** Compare a listing with the book's final.md lines; null when equal, else the first difference. */
export function karsilastir(kitap, l) {
  const [ilk] = l.satirlar;
  for (let i = 0; i < l.lines.length; i++) {
    const bulunan = (kitap[ilk - 1 + i] ?? '').trimEnd();
    const beklenen = l.lines[i].trimEnd();
    if (bulunan !== beklenen) return { satir: ilk + i, beklenen, bulunan };
  }
  return null;
}

export function kitapDizini() {
  return process.env.KITAP_DIZINI ?? 'C:/projects/modernSunucuTabProg';
}
