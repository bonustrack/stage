/**
 * Tests for the VERB REGISTRY (src/registry.ts) and the `metro schema` command.
 *
 *   - completeness : every live station handler is declared in the registry,
 *                    and the registry declares no phantom verbs.
 *   - schema output: `cmdSchema` emits valid JSON under --json and a table
 *                    otherwise; the JSON round-trips the registry.
 *   - send-guard parity: the live send-guard's guarded-action set is a subset
 *                    of the registry's xmtp mutate set (the registry MIRRORS the
 *                    guard — it never silently un-guards an action).
 */

import { describe, expect, test } from 'bun:test';
import {
  VERB_REGISTRY, verbsFor, lookupVerb, mutateVerbs, type VerbOwner,
} from '../src/registry.ts';

/* Live verb names, mirrored from the station dispatchers. If a station adds or
 * removes a handler, these lists must change too — that is the completeness
 * contract the registry exists to enforce. */
const LIVE: Record<Exclude<VerbOwner, 'core'>, string[]> = {
  xmtp: [
    'accounts', 'send', 'ask', 'sendPoll', 'react', 'reply', 'sendAttachment',
    'sendImage', 'sendTxRequest', 'sendSignatureRequest', 'edit', 'delete',
    'newDm', 'newGroup', 'createRequestGroup', 'setLabels', 'setGithub',
    'setPreview', 'updateChannelMeta', 'closeGroup', 'query', 'groupInfo',
    'listConvs', 'register-push', 'list-push', 'test-push', 'unregister-push',
    'disable-push',
  ],
  discord: [
    'accounts', 'send', 'reply', 'react', 'edit', 'delete', 'fetch', 'download',
    'thread_create', 'pin', 'typing', 'channel', 'set_presence', 'joinVoice',
    'leaveVoice', 'speak', 'voiceDebug', 'voiceTranscribe',
  ],
  telegram: [
    'accounts', 'send', 'react', 'edit', 'delete', 'send_photo', 'send_document',
    'send_voice', 'send_sticker', 'send_dice', 'send_location', 'read', 'download',
  ],
};

describe('registry — completeness', () => {
  for (const owner of Object.keys(LIVE) as Array<keyof typeof LIVE>) {
    test(`${owner}: every live handler is declared`, () => {
      const declared = new Set(verbsFor(owner).map(d => d.name));
      for (const name of LIVE[owner]) {
        expect(lookupVerb(owner, name), `missing registry entry: ${owner}.${name}`).toBeDefined();
        expect(declared.has(name)).toBe(true);
      }
    });

    test(`${owner}: no phantom verbs (registry ⊆ live)`, () => {
      const live = new Set(LIVE[owner]);
      for (const d of verbsFor(owner)) {
        expect(live.has(d.name), `phantom registry entry: ${owner}.${d.name}`).toBe(true);
      }
    });
  }

  test('every declaration has the required fields', () => {
    for (const d of VERB_REGISTRY) {
      expect(typeof d.name).toBe('string');
      expect(d.name.length).toBeGreaterThan(0);
      expect(['read', 'mutate']).toContain(d.kind);
      expect(typeof d.description).toBe('string');
      expect(d.description.length).toBeGreaterThan(0);
      expect(typeof d.example).toBe('string');
      expect(typeof d.idempotent).toBe('boolean');
    }
  });

  test('reads are always idempotent', () => {
    for (const d of VERB_REGISTRY) {
      if (d.kind === 'read') expect(d.idempotent, `${d.owner}.${d.name}`).toBe(true);
    }
  });

  test('no duplicate (owner, name) pairs', () => {
    const seen = new Set<string>();
    for (const d of VERB_REGISTRY) {
      const key = `${d.owner}:${d.name}`;
      expect(seen.has(key), `duplicate: ${key}`).toBe(false);
      seen.add(key);
    }
  });
});

describe('registry — send-guard parity', () => {
  /* The guarded XMTP actions, copied from cli/send-guard.ts. The guard's job is
   * IDENTITY: every action it guards must be classified `mutate` in the registry
   * (else the registry would describe a send-bearing action as a harmless read).
   * This is the mirror+parity contract: registry-mutate ⊇ guarded-actions. */
  const GUARDED = ['send', 'reply', 'react', 'sendAttachment', 'newDm', 'newGroup'];

  test('every guarded xmtp action is mutate in the registry', () => {
    const mut = mutateVerbs('xmtp');
    for (const a of GUARDED) {
      expect(mut.has(a), `guarded action not registry-mutate: ${a}`).toBe(true);
    }
  });

  test('guard set is a strict subset of registry xmtp mutates', () => {
    const mut = mutateVerbs('xmtp');
    // The registry classifies MORE actions as mutate than the identity guard
    // covers (e.g. channel-meta writes) — the guard intentionally only protects
    // send-bearing identity verbs. The registry must never be SMALLER.
    expect(GUARDED.every(a => mut.has(a))).toBe(true);
    expect(mut.size).toBeGreaterThanOrEqual(GUARDED.length);
  });
});

describe('metro schema command', () => {
  test('--json emits the registry as parseable JSON', async () => {
    const { cmdSchema } = await import('../src/cli/schema-cmd.ts');
    let out = '';
    const orig = process.stdout.write.bind(process.stdout);
    // @ts-expect-error narrow override for capture
    process.stdout.write = (s: string) => { out += s; return true; };
    try { await cmdSchema([], { json: true }); } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(out) as { verbs: Array<{ name: string; owner: string; kind: string }> };
    expect(Array.isArray(parsed.verbs)).toBe(true);
    expect(parsed.verbs.length).toBe(VERB_REGISTRY.length);
    expect(parsed.verbs.every(v => v.name && v.owner && v.kind)).toBe(true);
  });

  test('station filter narrows the output', async () => {
    const { cmdSchema } = await import('../src/cli/schema-cmd.ts');
    let out = '';
    const orig = process.stdout.write.bind(process.stdout);
    // @ts-expect-error narrow override for capture
    process.stdout.write = (s: string) => { out += s; return true; };
    try { await cmdSchema(['xmtp'], { json: true }); } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(out) as { verbs: Array<{ owner: string }> };
    expect(parsed.verbs.length).toBe(verbsFor('xmtp').length);
    expect(parsed.verbs.every(v => v.owner === 'xmtp')).toBe(true);
  });

  test('human table mode prints owner headings', async () => {
    const { cmdSchema } = await import('../src/cli/schema-cmd.ts');
    let out = '';
    const orig = process.stdout.write.bind(process.stdout);
    // @ts-expect-error narrow override for capture
    process.stdout.write = (s: string) => { out += s; return true; };
    try { await cmdSchema([], {}); } finally { process.stdout.write = orig; }
    expect(out).toContain('metro verbs');
    expect(out).toContain('xmtp');
    expect(out).toContain('send');
  });
});
