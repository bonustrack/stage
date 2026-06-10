/** Shared CLI primitives consumed by index.ts + config.ts. */

export type FlagValue = string | boolean | string[];
export type Flags = Record<string, FlagValue>;
export type ExitErr = Error & { code?: number; command?: string };

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
