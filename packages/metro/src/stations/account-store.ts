/** Shared daemon account-loader: read a per-station accounts JSON file, validate,
 *  apply an allowlist, with a single-account env fallback. Factored out of the
 *  near-identical discord/telegram/xmtp loadAccounts (validate/fallback injected). */

import { existsSync, readFileSync } from 'node:fs';
import { chmodIfExists } from '../secure-fs.js';

/** `die(msg)` - write `<prefix>: <msg>` to stderr and exit(2). */
export type Die = (msg: string) => never;

export interface MakeLoaderOpts<T> {
  /** Station label used in stderr diagnostics, e.g. 'discord'. */
  prefix: string;
  /** Resolved path to the accounts JSON file. */
  file: string;
  /** Env-var names whose comma-list (first set wins) restricts which ids load. */
  allowlistEnv: string[];
  /** Station-specific validation; should `die` on any invalid account. */
  validate: (raw: T[], die: Die) => void;
  /** Single-account fallback when the accounts file is absent. `die` on missing creds. */
  fallback: (die: Die) => T[];
}

export interface Loader<T> {
  /** `<prefix>: <msg>` → stderr + exit(2). Exposed so callers can reuse it. */
  die: Die;
  /** Resolve the account list: file (parse + validate + allowlist) or env fallback. */
  loadAccounts: () => T[];
}

/** Build a station account loader. All accounts carry a string `id`. */
export function makeAccountStore<T extends { id: string }>(opts: MakeLoaderOpts<T>): Loader<T> {
  const die: Die = (msg) => {
    process.stderr.write(`${opts.prefix}: ${msg}\n`);
    process.exit(2);
  };

  // Preserve `<PREFIX>_ONLY_ACCOUNTS ?? <PREFIX>_ACCOUNTS ?? ''` precedence:
  // `??` only falls through on undefined, so an empty-string env var still wins.
  let allowlistRaw: string | undefined;
  for (const k of opts.allowlistEnv) { if (allowlistRaw === undefined) allowlistRaw = process.env[k]; }
  const allowlist = new Set(
    (allowlistRaw ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  );

  function loadAccounts(): T[] {
    if (existsSync(opts.file)) {
      // Harden perms on load: existing creds may predate the 0600 policy
      // (known 0644 leak). MODE only — content is untouched.
      chmodIfExists(opts.file);
      let raw: T[];
      try { raw = JSON.parse(readFileSync(opts.file, 'utf8')) as T[]; }
      catch (e) { return die(`bad ${opts.file}: ${(e as Error).message}`); }
      if (!Array.isArray(raw) || raw.length === 0) die(`${opts.file} must be a non-empty array`);
      opts.validate(raw, die);
      const selected = allowlist.size ? raw.filter((a) => allowlist.has(a.id)) : raw;
      if (selected.length === 0) {
        die(`no accounts match ${opts.allowlistEnv[0]} (${[...allowlist].join(', ')})`);
      }
      return selected;
    }
    return opts.fallback(die);
  }

  return { die, loadAccounts };
}
