/** One piece of the scene that may be left out when the stage is too short: `hide` returns false when there was nothing to hide. */
export interface Birakilabilir {
  hide(): boolean;
  show(): void;
}

/**
 * Hides pieces in the given order (least important first) until `fits` is true, calling `apply` after every change; then
 * puts back, most important first, every piece that fits again once the later (larger) ones are gone. Returns nothing:
 * the pieces hold their own state.
 */
export function fitDrops(pieces: readonly Birakilabilir[], fits: () => boolean, apply: () => void): void {
  const dropped: boolean[] = [];
  for (const p of pieces) {
    if (fits()) { dropped.push(false); continue; }
    const d = p.hide();
    dropped.push(d);
    if (d) apply();
  }
  for (let i = pieces.length - 1; i >= 0; i--) {
    if (!dropped[i]) continue;
    pieces[i].show();
    apply();
    if (!fits()) {
      pieces[i].hide();
      apply();
    }
  }
}
