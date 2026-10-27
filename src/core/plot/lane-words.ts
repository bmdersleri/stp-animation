/**
 * A lane title (or a call in a message label) that is wider than its room, broken at camelCase, dot, space, hyphen
 * and call-paren (`f(`) boundaries into the fewest lines that fit ("apiAnahtariKontrolu" -> "apiAnahtari",
 * "Kontrolu"); a title that fits, or has no boundary, stays whole.
 */
export function breakWord(text: string, room: number, width: (t: string) => number): string[] {
  if (width(text) <= room) return [text];
  const out: string[] = [];
  for (const piece of text.split(/(?=[A-Z])|(?=\.)|(?<=[ -])|(?<=\w\()(?!\))/)) {
    const last = out.length - 1;
    if (last >= 0 && width(out[last] + piece) <= room) out[last] += piece;
    else out.push(piece);
  }
  return out.flatMap((l) => hyphenate(l.trim(), room, width));
}

/** A single word wider than the room, cut into hyphenated chunks that fit (a word that fits stays whole). */
function hyphenate(word: string, room: number, width: (t: string) => number): string[] {
  if (width(word) <= room || word.length < 2) return [word];
  const chunks: string[] = [];
  let rest = word;
  while (rest.length > 1 && width(rest) > room) {
    let n = rest.length - 1;
    while (n > 1 && width(`${rest.slice(0, n)}-`) > room) n--;
    chunks.push(`${rest.slice(0, n)}-`);
    rest = rest.slice(n);
  }
  chunks.push(rest);
  return chunks;
}
