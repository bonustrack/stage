import { describe, expect, test } from 'bun:test';
import { guardClientAccess } from '../lib/xmtp.clientAccess.web';
import { makeSenderFilterPublisher, prepareNotifyingSend } from '@stage-labs/client/xmtp/pushSenderFilter';

type AccessClient = Parameters<typeof guardClientAccess>[0];
const IDENTIFIER = { identifier: '0x0000000000000000000000000000000000000001', identifierKind: 0 };
const ALIASING = 'recursive use of an object detected which would lead to unsafe aliasing in rust';
const tick = (): Promise<void> => Bun.sleep(0);

function fixture() {
  const readGate = Promise.withResolvers<undefined>();
  const signGate = Promise.withResolvers<undefined>();
  const events: string[] = [];
  const state = { inboxId: 'inbox', recoveryIdentifier: IDENTIFIER, installations: [], accountIdentifiers: [IDENTIFIER] };
  let readers = 0;
  let writing = false;
  let readFailure: Error | undefined;
  let signFailure: Error | undefined;
  async function read<T>(value: T): Promise<T> {
    if (writing) throw new Error(ALIASING);
    readers += 1;
    events.push('read');
    try { await readGate.promise; if (readFailure) throw readFailure; return value; }
    finally { readers -= 1; }
  }
  async function sign(): Promise<Uint8Array> {
    if (readers > 0 || writing) throw new Error(ALIASING);
    writing = true;
    events.push('sign');
    try { await signGate.promise; if (signFailure) throw signFailure; return new Uint8Array([7]); }
    finally { writing = false; }
  }
  const client: AccessClient = {
    canMessage: () => read(new Map([[IDENTIFIER.identifier, true]])),
    fetchInboxIdByIdentifier: () => read('inbox'),
    fetchKeyPackageStatuses: () => read(new Map()),
    signWithInstallationKey: sign,
    verifySignedWithInstallationKey: async () => (await sign()).length > 0,
    conversations: { fetchDmByIdentifier: () => read(undefined) },
    preferences: {
      sync: () => read({ numEligible: 0, numSynced: 0 }),
      inboxState: () => read(state), fetchInboxState: () => read(state),
      getInboxStates: () => read([state]), fetchInboxStates: () => read([state]),
      setConsentStates: () => read(undefined), getConsentState: () => read(0),
    },
  };
  return {
    client, events, releaseRead: () => readGate.resolve(undefined), releaseSign: () => signGate.resolve(undefined),
    failRead: (error: Error) => { readFailure = error; },
    failSign: (error: Error) => { signFailure = error; },
  };
}

const READS: [string, (client: AccessClient) => Promise<unknown>][] = [
  ['canMessage', client => client.canMessage([IDENTIFIER])],
  ['fetchInboxIdByIdentifier', client => client.fetchInboxIdByIdentifier(IDENTIFIER)],
  ['fetchKeyPackageStatuses', client => client.fetchKeyPackageStatuses([])],
  ['conversations.fetchDmByIdentifier', client => client.conversations.fetchDmByIdentifier(IDENTIFIER)],
  ['preferences.sync', client => client.preferences.sync()],
  ['preferences.inboxState', client => client.preferences.inboxState()],
  ['preferences.fetchInboxState', client => client.preferences.fetchInboxState()],
  ['preferences.getInboxStates', client => client.preferences.getInboxStates(['inbox'])],
  ['preferences.fetchInboxStates', client => client.preferences.fetchInboxStates(['inbox'])],
  ['preferences.setConsentStates', client => client.preferences.setConsentStates([])],
  ['preferences.getConsentState', client => client.preferences.getConsentState(0, 'inbox')],
];

describe('web client signing access', () => {
  test.each(READS)('signing waits for %s without retrying or losing its result', async (_, start) => {
    const f = fixture();
    const client = guardClientAccess(f.client);
    const read = start(client);
    await tick();
    const signed = client.signWithInstallationKey('payload').catch((error: unknown) => error);
    await tick();
    expect(f.events).toEqual(['read']);
    f.releaseRead();
    await read;
    await tick();
    expect(f.events).toEqual(['read', 'sign']);
    f.releaseSign();
    expect(await signed).toEqual(new Uint8Array([7]));
  });

  test('readers stay concurrent but cannot overtake a pending signer', async () => {
    const f = fixture();
    const client = guardClientAccess(f.client);
    const a = client.preferences.fetchInboxState();
    const b = client.fetchInboxIdByIdentifier(IDENTIFIER);
    await tick();
    expect(f.events).toEqual(['read', 'read']);
    const sign = client.signWithInstallationKey('payload');
    const later = client.preferences.getInboxStates(['inbox']);
    await tick();
    expect(f.events).toEqual(['read', 'read']);
    f.releaseRead();
    await Promise.all([a, b]);
    await tick();
    expect(f.events).toEqual(['read', 'read', 'sign']);
    f.releaseSign();
    await Promise.all([sign, later]);
    expect(f.events).toEqual(['read', 'read', 'sign', 'read']);
  });

  test('failed reads and signatures propagate once and do not poison subsequent work', async () => {
    const f = fixture();
    const client = guardClientAccess(f.client);
    const failure = new Error('identity unavailable');
    f.failRead(failure);
    const read = client.preferences.fetchInboxState().catch((error: unknown) => error);
    await tick();
    const sign = client.signWithInstallationKey('payload');
    f.releaseRead();
    expect(await read).toBe(failure);
    f.releaseSign();
    expect(await sign).toEqual(new Uint8Array([7]));
    f.failSign(new Error('sign failed'));
    await expect(client.signWithInstallationKey('other')).rejects.toThrow('sign failed');
    await expect(client.canMessage([])).rejects.toThrow('identity unavailable');
    expect(f.events).toEqual(['read', 'sign', 'sign', 'read']);
  });

  test('guards are per client, idempotent, and preserve SDK receivers and arguments', async () => {
    const a = fixture();
    const b = fixture();
    const original = a.client;
    original.signWithInstallationKey = function (text) {
      expect(this).toBe(original);
      expect(text).toBe('bound payload');
      return Promise.resolve(new Uint8Array([9]));
    };
    const client = guardClientAccess(original);
    expect(guardClientAccess(client)).toBe(original);
    const read = guardClientAccess(b.client).canMessage([]);
    expect(await client.signWithInstallationKey('bound payload')).toEqual(new Uint8Array([9]));
    b.releaseRead();
    await read;
  });

  test('installation verification also takes exclusive access', async () => {
    const f = fixture();
    const client = guardClientAccess(f.client);
    const read = client.preferences.fetchInboxStates(['inbox']);
    await tick();
    const verify = client.verifySignedWithInstallationKey('payload', new Uint8Array([7]));
    await tick();
    expect(f.events).toEqual(['read']);
    f.releaseRead();
    await read;
    f.releaseSign();
    expect(await verify).toBe(true);
  });

  test('a notifying send waits for safe signing and authenticated publication before sending once', async () => {
    const f = fixture();
    const client = guardClientAccess(f.client);
    const background = client.preferences.fetchInboxState();
    await tick();
    let posts = 0;
    let sends = 0;
    const publisher = makeSenderFilterPublisher();
    const send = prepareNotifyingSend(true, () => publisher.publish({
      installationId: 'a'.repeat(64), current: () => true, signal: new AbortController().signal,
      groupKey: async () => 'b'.repeat(64), sign: text => client.signWithInstallationKey(text),
      syncPreferences: async () => undefined, collectTopics: async () => ({ topics: [], hmacKeys: {} }),
      post: async () => { posts += 1; },
    }), () => undefined).then(() => { sends += 1; });
    await tick();
    expect(posts).toBe(0);
    expect(sends).toBe(0);
    f.releaseRead();
    await background;
    f.releaseSign();
    await send;
    expect(f.events).toEqual(['read', 'sign']);
    expect(posts).toBe(1);
    expect(sends).toBe(1);
  });
});
