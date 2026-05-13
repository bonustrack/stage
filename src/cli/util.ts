/** Shared CLI primitives consumed by index.ts + config.ts. */

export type FlagValue = string | boolean | string[];
export type Flags = Record<string, FlagValue>;
export type ExitErr = Error & { code?: number };

export const exitErr = (msg: string, code: number): ExitErr => Object.assign(new Error(msg), { code });
export const isJson = (f: Flags): boolean => f.json === true;
export const writeJson = (obj: unknown): void => void process.stdout.write(JSON.stringify(obj) + '\n');
export const emit = (f: Flags, human: string, structured: unknown): void =>
  isJson(f) ? writeJson(structured) : void process.stdout.write(human + '\n');

export const need = (positional: string[], min: number, usage: string): void => {
  if (positional.length < min) throw exitErr(`usage: ${usage}`, 1);
};

/** Return the last string value for `key` (or undefined). */
export function flagOne(f: Flags, key: string): string | undefined {
  const v = f[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length) return v[v.length - 1];
  return undefined;
}

/** Return all string values for `key`, also splitting comma-separated entries. */
export function flagList(f: Flags, key: string): string[] {
  const v = f[key];
  const raw = typeof v === 'string' ? [v] : Array.isArray(v) ? v : [];
  return raw.flatMap(s => s.split(',').map(p => p.trim()).filter(Boolean));
}

export function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [], flags: Flags = {};
  const add = (k: string, val: string | boolean): void => {
    const cur = flags[k];
    if (cur === undefined) { flags[k] = val; return; }
    if (typeof val === 'boolean') { flags[k] = val; return; }
    flags[k] = Array.isArray(cur) ? [...cur, val] : [cur as string, val];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq !== -1) { add(a.slice(2, eq), a.slice(eq + 1)); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { add(a.slice(2), next); i++; }
    else add(a.slice(2), true);
  }
  return { positional, flags };
}

export async function resolveText(positional: string[], from: number): Promise<string> {
  if (positional.length > from) return positional.slice(from).join(' ');
  if (process.stdin.isTTY) throw exitErr('text is required (or pipe text on stdin)', 1);
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const stdin = Buffer.concat(chunks).toString('utf8').replace(/\n$/, '');
  if (!stdin) throw exitErr('text is required (or pipe text on stdin)', 1);
  return stdin;
}
