// The project has no @types/node (tsconfig `types` is vite/client only); declare
// just the Node APIs the scaffold test uses.
declare module 'node:fs' {
  const fs: {
    mkdtempSync(prefix: string): string;
    mkdirSync(path: string): void;
    copyFileSync(from: string, to: string): void;
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: 'utf8'): string;
    rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
  };
  export default fs;
}
declare module 'node:os' {
  const os: { tmpdir(): string };
  export default os;
}
declare module 'node:path' {
  const path: { join(...parts: string[]): string };
  export default path;
}
declare module 'node:util' {
  export function inspect(value: unknown): string;
}

declare module 'node:child_process' {
  export function spawnSync(
    command: string,
    args: string[],
    options: { env: Record<string, string | undefined>; encoding: 'utf8' },
  ): { status: number | null; stdout: string; stderr: string };
}

declare const process: { execPath: string; env: Record<string, string | undefined> };

declare module 'node:crypto' {
  interface Digestible {
    update(data: string): Digestible;
    digest(encoding: 'hex' | 'base64url'): string;
  }
  export function createHash(algorithm: string): Digestible;
  export function createHmac(algorithm: string, key: string): Digestible;
  export function scryptSync(password: string, salt: string, keylen: number): { toString(encoding: 'hex'): string };
}

declare const Buffer: { from(text: string): { toString(encoding: 'base64url'): string } };
