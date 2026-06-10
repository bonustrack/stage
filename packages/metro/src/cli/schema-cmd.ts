/** `metro schema` / `metro verbs` — dump the verb registry. Purely read-only
 *  introspection: a human table by default, the full registry under `--json`.
 *  This is NEW surface; it changes no runtime behavior. */

import { VERB_REGISTRY, type VerbDecl, type VerbOwner } from '../registry.js';
import { flagOne, isJson, writeJson, type Flags } from './util.js';

const OWNER_ORDER: VerbOwner[] = ['core', 'xmtp', 'discord', 'telegram'];

/** Serialize one verb for `--json` (inputSchema is a function — surface a flag). */
function toJson(d: VerbDecl): Record<string, unknown> {
  return {
    name: d.name, owner: d.owner, kind: d.kind, guarded: d.guarded === true,
    idempotent: d.idempotent, description: d.description, example: d.example,
    hasInputSchema: d.inputSchema !== undefined,
  };
}

export async function cmdSchema(positional: string[], f: Flags): Promise<void> {
  /** Optional filter: `metro schema xmtp` or `--station xmtp`. */
  const only = (positional[0] ?? flagOne(f, 'station')) as VerbOwner | undefined;
  const rows = only ? VERB_REGISTRY.filter(d => d.owner === only) : VERB_REGISTRY;

  if (isJson(f)) return writeJson({ verbs: rows.map(toJson) });

  process.stdout.write('metro verbs\n\n');
  for (const owner of OWNER_ORDER) {
    const group = rows.filter(d => d.owner === owner);
    if (!group.length) continue;
    process.stdout.write(`${owner}\n`);
    const widest = Math.max(...group.map(d => d.name.length));
    for (const d of group) {
      const kind = d.kind === 'mutate' ? 'mutate' : 'read  ';
      const idem = d.idempotent ? '' : ' (non-idempotent)';
      process.stdout.write(`  ${d.name.padEnd(widest)}  ${kind}  ${d.description}${idem}\n`);
    }
    process.stdout.write('\n');
  }
}
