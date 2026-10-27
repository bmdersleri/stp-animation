/**
 * Node 24 `util.inspect` with its default options (depth 2, breakLength 80, compact 3, maxArrayLength 100),
 * for plain objects, arrays, strings, numbers, booleans, null and undefined: the text `console.log` prints for
 * such a value. A port of the parts of Node's lib/internal/util/inspect.js these types need; no other types.
 * Browser code: it must not import node:util.
 */
const BREAK_LENGTH = 80;
const COMPACT = 3;
const DEPTH = 2;
const MAX_ARRAY = 100;
const MIN_LINE_WIDTH = 16;
const IDENT = /^[a-zA-Z_][a-zA-Z_0-9]*$/;

interface Ctx {
  indentationLvl: number;
  currentDepth: number;
}

const META: Record<string, string> = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '\\': '\\\\' };

/** Quotes a string the way Node does: ' by default, " or ` when the text holds quotes. */
function quote(s: string): string {
  let q = "'";
  if (s.includes("'")) {
    if (!s.includes('"')) q = '"';
    else if (!s.includes('`') && !s.includes('${')) q = '`';
  }
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === q && q === "'") out += "\\'";
    else if (META[ch] !== undefined) out += META[ch];
    else if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) out += `\\x${c.toString(16).toUpperCase().padStart(2, '0')}`;
    else out += ch;
  }
  return q + out + q;
}

function formatString(ctx: Ctx, s: string): string {
  if (s.length > MIN_LINE_WIDTH && s.length > BREAK_LENGTH - ctx.indentationLvl - 4) {
    return s
      .split(/(?<=\n)/)
      .map((line) => quote(line))
      .join(` +\n${' '.repeat(ctx.indentationLvl + 2)}`);
  }
  return quote(s);
}

function formatValue(ctx: Ctx, v: unknown, recurseTimes: number): string {
  if (typeof v === 'string') return formatString(ctx, v);
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'boolean' || v === null || v === undefined) return String(v);
  return formatObject(ctx, v as object, recurseTimes);
}

function formatObject(ctx: Ctx, value: object, recurseTimes: number): string {
  const isArray = Array.isArray(value);
  const braces: [string, string] = isArray ? ['[', ']'] : ['{', '}'];
  const keys = isArray ? [] : Object.keys(value);
  if (isArray ? value.length === 0 : keys.length === 0) return `${braces[0]}${braces[1]}`;
  if (recurseTimes > DEPTH) return isArray ? '[Array]' : '[Object]';
  recurseTimes += 1;
  ctx.currentDepth = recurseTimes;
  const output: string[] = [];
  const child = (v: unknown): string => {
    ctx.indentationLvl += 2;
    const s = formatValue(ctx, v, recurseTimes);
    ctx.indentationLvl -= 2;
    return s;
  };
  if (isArray) {
    const arr = value as unknown[];
    const shown = Math.min(MAX_ARRAY, arr.length);
    for (let i = 0; i < shown; i++) output.push(child(arr[i]));
    if (arr.length > shown) {
      const rest = arr.length - shown;
      output.push(`... ${rest} more item${rest > 1 ? 's' : ''}`);
    }
  } else {
    for (const k of keys) output.push(`${IDENT.test(k) ? k : quote(k)}: ${child((value as Record<string, unknown>)[k])}`);
  }
  return reduceToSingleString(ctx, output, braces, isArray, recurseTimes, isArray ? (value as unknown[]) : undefined);
}

function isBelowBreakLength(output: string[], start: number): boolean {
  let total = output.length + start;
  if (total + output.length > BREAK_LENGTH) return false;
  for (const o of output) {
    total += o.length;
    if (total > BREAK_LENGTH) return false;
  }
  return true;
}

function reduceToSingleString(ctx: Ctx, output: string[], braces: [string, string], isArray: boolean, recurseTimes: number, value?: unknown[]): string {
  const entries = output.length;
  if (isArray && entries > 6) output = groupArrayElements(ctx, output, value);
  if (ctx.currentDepth - recurseTimes < COMPACT && entries === output.length) {
    const start = output.length + ctx.indentationLvl + braces[0].length + 10;
    if (isBelowBreakLength(output, start)) {
      const joined = output.join(', ');
      if (!joined.includes('\n')) return `${braces[0]} ${joined} ${braces[1]}`;
    }
  }
  const indentation = `\n${' '.repeat(ctx.indentationLvl)}`;
  return `${braces[0]}${indentation}  ${output.join(`,${indentation}  `)}${indentation}${braces[1]}`;
}

/** Node's column layout for arrays of more than six entries. */
function groupArrayElements(ctx: Ctx, output: string[], value?: unknown[]): string[] {
  let totalLength = 0;
  let maxLength = 0;
  let outputLength = output.length;
  if (value && MAX_ARRAY < value.length) outputLength--; // the "... n more items" entry is not grouped
  const separatorSpace = 2;
  const dataLen: number[] = new Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const len = output[i].length;
    dataLen[i] = len;
    totalLength += len + separatorSpace;
    if (maxLength < len) maxLength = len;
  }
  const actualMax = maxLength + separatorSpace;
  if (actualMax * 3 + ctx.indentationLvl < BREAK_LENGTH && (totalLength / actualMax > 5 || maxLength <= 6)) {
    const averageBias = Math.sqrt(actualMax - totalLength / output.length);
    const biasedMax = Math.max(actualMax - 3 - averageBias, 1);
    const columns = Math.min(
      Math.round(Math.sqrt(2.5 * biasedMax * outputLength) / biasedMax),
      Math.floor((BREAK_LENGTH - ctx.indentationLvl) / actualMax),
      COMPACT * 4,
      15,
    );
    if (columns <= 1) return output;
    const tmp: string[] = [];
    const maxLineLength: number[] = [];
    for (let i = 0; i < columns; i++) {
      let lineLength = 0;
      for (let j = i; j < output.length; j += columns) if (dataLen[j] > lineLength) lineLength = dataLen[j];
      maxLineLength.push(lineLength + separatorSpace);
    }
    let padStart = true;
    if (value !== undefined) {
      for (let i = 0; i < output.length; i++) {
        if (typeof value[i] !== 'number') {
          padStart = false;
          break;
        }
      }
    }
    for (let i = 0; i < outputLength; i += columns) {
      const max = Math.min(i + columns, outputLength);
      let str = '';
      let j = i;
      for (; j < max - 1; j++) {
        const cell = `${output[j]}, `;
        str += padStart ? cell.padStart(maxLineLength[j - i]) : cell.padEnd(maxLineLength[j - i]);
      }
      str += padStart ? output[j].padStart(maxLineLength[j - i] - separatorSpace) : output[j];
      tmp.push(str);
    }
    if (value && MAX_ARRAY < value.length) tmp.push(output[outputLength]);
    output = tmp;
  }
  return output;
}

export function nodeInspect(value: unknown): string {
  return formatValue({ indentationLvl: 0, currentDepth: 0 }, value, 0);
}
