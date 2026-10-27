import './code-trace.css';

/** What the panel shows: numbered source lines with the active ones highlighted. `notes` maps a 1-based line to a short remark; `window` n renders only lines within n of the first active line. */
export interface CodeTraceSpec {
  title: string;
  lines: readonly string[];
  active: readonly number[];
  notes?: Readonly<Record<number, string>>;
  window?: number;
}

/**
 * A code trace panel (`.code-trace` > `.code-trace-title` + `ol.code-trace-lines` of `li[data-line]`).
 * Active lines are `.active`; a line with a note holds a `span.code-trace-note`.
 */
export class CodeTrace {
  readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly list: HTMLOListElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'code-trace';
    this.title = doc.createElement('div');
    this.title.className = 'code-trace-title';
    this.list = doc.createElement('ol');
    this.list.className = 'code-trace-lines';
    this.root.append(this.title, this.list);
    host.append(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  update(spec: CodeTraceSpec): void {
    const doc = this.root.ownerDocument;
    this.title.textContent = spec.title;
    const active = new Set(spec.active);
    const first = spec.active.length > 0 ? Math.min(...spec.active) : undefined;
    const rows: HTMLLIElement[] = [];
    spec.lines.forEach((text, i) => {
      const n = i + 1;
      if (spec.window !== undefined && first !== undefined && Math.abs(n - first) > spec.window) return;
      const li = doc.createElement('li');
      li.dataset.line = String(n);
      if (active.has(n)) li.className = 'active';
      const code = doc.createElement('span');
      code.className = 'code-trace-text';
      code.textContent = text;
      li.append(code);
      const note = spec.notes?.[n];
      if (note) {
        const s = doc.createElement('span');
        s.className = 'code-trace-note';
        s.textContent = note;
        li.append(s);
      }
      rows.push(li);
    });
    this.list.replaceChildren(...rows);
    const target = first === undefined ? undefined : rows.find((li) => li.dataset.line === String(first));
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' });
  }
}
