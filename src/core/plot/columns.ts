/**
 * Puts each block into one of two columns (reading order kept inside a column) so that the taller column is as short
 * as possible. The first block always stays in column A. Where layout is unavailable (all heights 0) the first two
 * blocks go to A and the rest to B.
 */
export function balanceColumns(blocks: readonly HTMLElement[], a: HTMLElement, b: HTMLElement): void {
  a.append(...blocks);
  const h = blocks.map((x) => (x.hidden ? 0 : x.getBoundingClientRect().height));
  let best = 0b0011;
  let bestH = Infinity;
  for (let mask = 1; mask < 1 << h.length; mask += 2) {
    let ha = 0;
    let hb = 0;
    h.forEach((x, i) => ((mask >> i) & 1 ? (ha += x) : (hb += x)));
    if (Math.max(ha, hb) < bestH - 0.5) {
      bestH = Math.max(ha, hb);
      best = mask;
    }
  }
  if (h.every((x) => x === 0)) best = 0b0011;
  b.append(...blocks.filter((_, i) => !((best >> i) & 1)));
}
