// Shared types + the tiny `line` validator for the verb registry data files.
// Split out so each station's verb table stays under the per-file line cap while
// all of them share one declaration shape. See registry.ts for the aggregation
// and the public helpers.

import { v, type Validator } from './schema.js';

/** Read vs mutate. `mutate` = sends/changes remote state under an identity. */
export type VerbKind = 'read' | 'mutate';

/** Where a verb runs: a platform station, or Metro core (the daemon itself). */
export type VerbOwner = 'xmtp' | 'discord' | 'telegram' | 'core';

/** One declared verb. `inputSchema` is an optional runtime validator (the same
 *  tiny combinator the control verbs use). `idempotent` answers "does presenting
 *  the same call twice produce the same effect" (reads are trivially idempotent). */
export type VerbDecl = {
  /** Action name as passed to `metro call <station> <name>` (or the CLI token for core). */
  readonly name: string;
  /** Owning station, or 'core' for daemon-level CLI verbs. */
  readonly owner: VerbOwner;
  /** read = no remote write; mutate = writes/sends under an account identity. */
  readonly kind: VerbKind;
  /** Identity send-guard flag (xmtp only): true for send-bearing verbs that emit
   *  under an account's identity. NARROWER than `mutate` (channel-meta/push are
   *  mutate but not guarded). cli/send-guard.ts derives its set from this flag. */
  readonly guarded?: boolean;
  /** Optional arg validator. Omitted where args are free-form / not yet typed. */
  readonly inputSchema?: Validator<unknown>;
  /** One-line human description. */
  readonly description: string;
  /** A copy-pasteable example invocation. */
  readonly example: string;
  /** Re-presenting the same call is safe (no duplicate side effect). */
  readonly idempotent: boolean;
};

/** Shared `line` field validator (non-empty string). */
export const line = v.string({ min: 1 });
