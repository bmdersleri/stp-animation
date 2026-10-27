/** One book listing as a concept's code-text.ts holds it. Type-only imports only: a Node script imports those files directly. */
export interface Listing {
  id: string;
  title: string;
  /** Book chapter folder, e.g. 'b05-express-web-server'. */
  bolum: string;
  /** First and last line in the chapter's final.md (code fences excluded). */
  satirlar: readonly [number, number];
  lines: readonly string[];
}

export function listing(all: readonly Listing[], id: string): Listing {
  const l = all.find((x) => x.id === id);
  if (!l) throw new Error(`unknown listing "${id}"`);
  return l;
}

/** 1-based number of the first line (at or after `from`) containing `fragment`; throws when none does. */
export function lineOf(l: Listing, fragment: string, from = 1): number {
  for (let i = Math.max(0, from - 1); i < l.lines.length; i++) if (l.lines[i].includes(fragment)) return i + 1;
  throw new Error(`listing ${l.id} has no line containing "${fragment}" from line ${from}`);
}
