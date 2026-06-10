// VERB REGISTRY — single source of truth for Metro station/core verbs.
//
// Each verb is declared once (in registry-xmtp.ts / registry-chat.ts / below)
// with {name, owner, kind:read|mutate, inputSchema, description, example,
// idempotent}. That ONE declaration feeds:
//   - `metro schema` / `metro verbs` introspection (human table + --json),
//   - the send-guard's guarded-action set (DERIVED here via guardedVerbs() — the
//     send-guard imports it, so the registry's `guarded` flag is the single
//     source of truth; a parity test in test/registry.test.ts pins the set),
//   - `metro call` arg validation: cmdCall validates against a verb's
//     `inputSchema` when present (validateCallArgs), so inputSchema is
//     load-bearing — not documentation.
//
// ADDITIVE + behavior-preserving: the registry now drives the guard set and call
// validation, but the guarded set and accepted/rejected args are unchanged.

import { XMTP_VERBS } from './registry-xmtp.js';
import { DISCORD_VERBS, TELEGRAM_VERBS } from './registry-chat.js';
import { SchemaError } from './schema.js';
import type { VerbDecl, VerbOwner } from './registry-types.js';

export type { VerbDecl, VerbKind, VerbOwner } from './registry-types.js';

/* ──────────── Core (daemon-level) verbs ──────────── */
// The CLI nouns that talk to the daemon directly rather than to a station train.
const CORE_VERBS: VerbDecl[] = [
  { name: 'lines', owner: 'core', kind: 'read', idempotent: true,
    description: 'List recently-seen conversations.', example: 'metro lines' },
  { name: 'history', owner: 'core', kind: 'read', idempotent: true,
    description: 'Read the universal message log (newest first).', example: 'metro history --limit 20' },
  { name: 'tail', owner: 'core', kind: 'read', idempotent: true,
    description: 'Subscribe to the event log (claim-aware).', example: 'metro tail --follow' },
  { name: 'read', owner: 'core', kind: 'read', idempotent: true,
    description: 'Read recent messages for a line.', example: 'metro read <line>' },
  { name: 'claims', owner: 'core', kind: 'read', idempotent: true,
    description: 'Print the current claims map.', example: 'metro claims' },
  { name: 'claim', owner: 'core', kind: 'mutate', idempotent: true,
    description: 'Take exclusive ownership of a line.', example: 'metro claim <line>' },
  { name: 'release', owner: 'core', kind: 'mutate', idempotent: true,
    description: 'Release a claimed line back to broadcast.', example: 'metro release <line>' },
  { name: 'trains', owner: 'core', kind: 'read', idempotent: true,
    description: 'List supervised trains (running, pid, fail count).', example: 'metro trains' },
  { name: 'webhook', owner: 'core', kind: 'mutate', idempotent: false,
    description: 'Manage HTTP receive endpoints (add/list/remove).', example: 'metro webhook add github' },
  { name: 'tunnel', owner: 'core', kind: 'mutate', idempotent: true,
    description: 'Configure / inspect a Cloudflare named tunnel.', example: 'metro tunnel status' },
  { name: 'schema', owner: 'core', kind: 'read', idempotent: true,
    description: 'Dump the verb registry (human table or --json).', example: 'metro schema --json' },
  { name: 'verbs', owner: 'core', kind: 'read', idempotent: true,
    description: 'Alias of schema — list all registered verbs.', example: 'metro verbs' },
];

/** The full registry: the single source of truth for station + core verbs. */
export const VERB_REGISTRY: readonly VerbDecl[] = Object.freeze([
  ...XMTP_VERBS, ...DISCORD_VERBS, ...TELEGRAM_VERBS, ...CORE_VERBS,
]);

/** All verbs for a given owner (station or 'core'). */
export function verbsFor(owner: VerbOwner): VerbDecl[] {
  return VERB_REGISTRY.filter(d => d.owner === owner);
}

/** Look up a single verb declaration by owner + name. */
export function lookupVerb(owner: VerbOwner, name: string): VerbDecl | undefined {
  return VERB_REGISTRY.find(d => d.owner === owner && d.name === name);
}

/** The set of `mutate` verb names for a station — what the registry says writes
 *  remote state. The send-guard's guarded-action set must be a subset of this
 *  (asserted by the parity test); the registry never *removes* a guard. */
export function mutateVerbs(owner: VerbOwner): Set<string> {
  return new Set(verbsFor(owner).filter(d => d.kind === 'mutate').map(d => d.name));
}

/** Identity-send-guarded verb names for a station — the single source of truth
 *  for cli/send-guard.ts (a subset of `mutateVerbs`; every guarded is mutate). */
export function guardedVerbs(owner: VerbOwner): Set<string> {
  return new Set(verbsFor(owner).filter(d => d.guarded).map(d => d.name));
}

/** Validate `metro call <owner> <name>` args against the verb's `inputSchema`.
 *  No-op pass-through when the verb is unknown or has no `inputSchema` (keeps
 *  today's behavior); throws SchemaError when a declared schema rejects args. */
export function validateCallArgs(owner: VerbOwner, name: string, args: unknown): unknown {
  const decl = lookupVerb(owner, name);
  if (!decl?.inputSchema) return args;
  return decl.inputSchema(args, name);
}

export { SchemaError };
