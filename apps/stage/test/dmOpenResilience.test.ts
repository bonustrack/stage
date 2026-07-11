
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const read = (...p: string[]) => readFileSync(join(APP_ROOT, ...p), 'utf8');

const resolveSrc = read('lib', 'dmResolve.ts');
const hooksSrc = read('app', '(conv)', 'conv.hooks.ts');
const outboxSrc = read('lib', 'dmOutbox.ts');
const streamSrc = read('modules', 'messaging', 'streamSync.ts');
const webSeam = read('lib', 'xmtp.conv.web.ts');
const nativeSeam = read('lib', 'xmtp.conv.ts');
const screenSrc = read('app', '(conv)', '[convId].tsx');
const pendingSrc = read('components', 'PendingConversation.tsx');

describe('address-routed DM opening never mints or masks a peer-less stub DM', () => {
  test('existing DM with the peer joined wins before anything else', () => {
    const lookupIdx = resolveSrc.indexOf('findExistingDmWithAddress(address)');
    const joinedIdx = resolveSrc.indexOf('existing?.peerJoined');
    const createIdx = resolveSrc.indexOf('openDmWithAddress(address)');
    expect(lookupIdx).toBeGreaterThanOrEqual(0);
    expect(joinedIdx).toBeGreaterThan(lookupIdx);
    expect(createIdx).toBeGreaterThan(joinedIdx);
  });
  test('a stub DM is repaired or surfaced as unreachable, never opened as-is', () => {
    expect(resolveSrc).toContain('if (existing) return resolveStubDm(existing.convId, address)');
    expect(resolveSrc).toContain('repairDmMembership(convId, address)');
  });
  test('reachability is probed BEFORE the first create so a failed create cannot plant a stub', () => {
    const probeIdx = resolveSrc.indexOf('const reason = await dmUnreachableReason(address)');
    const createIdx = resolveSrc.indexOf('await openDmWithAddress(address)');
    expect(probeIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThan(probeIdx);
  });
  test('there is no blind createDm retry (it would silently return the stub)', () => {
    const first = resolveSrc.indexOf('openDmWithAddress(address)');
    const last = resolveSrc.lastIndexOf('openDmWithAddress(address)');
    expect(first).toBe(last);
  });
});

describe('unreachable peers get a pending conversation with an outbox, not a dead end', () => {
  test('unregistered and stale-installations resolve to a pending composer', () => {
    expect(hooksSrc).toContain("error === 'unregistered' || error === 'stale-installations'");
    expect(hooksSrc).toContain('pendingAddress: isQueueable(res.error) ? param : null');
    expect(screenSrc).toContain('<PendingConversation');
  });
  test('sends are queued first, then flushed through the stub-safe ladder', () => {
    expect(pendingSrc).toContain('enqueueDm(address, text)');
    expect(pendingSrc).toContain('flushDmOutboxFor(address)');
    const resolveIdx = outboxSrc.indexOf('await resolveDmConvId(address)');
    const deliverIdx = outboxSrc.indexOf('await deliverQueued(address, res.convId)');
    expect(resolveIdx).toBeGreaterThanOrEqual(0);
    expect(deliverIdx).toBeGreaterThan(resolveIdx);
    expect(outboxSrc).toContain('xmtpSendText(lineOfConv(convId), item.text)');
  });
  test('delivered items leave the queue one by one, failures stay queued', () => {
    expect(outboxSrc).toContain('store.set(withoutItem(store.get(), item.id))');
  });
  test('the queue flushes on messaging start and periodically, not only from the pending screen', () => {
    expect(streamSrc).toContain('void flushDmOutbox()');
    expect(streamSrc).toContain('setInterval(() => { void flushDmOutbox(); }, OUTBOX_FLUSH_INTERVAL_MS)');
  });
  test('the pending screen swaps to the real conversation after delivery', () => {
    expect(pendingSrc).toContain('if (convId) onDelivered()');
    expect(screenSrc).toContain('onDelivered={resolved.retry}');
  });
});

describe('the seams verify peer membership and sync before concluding no DM exists', () => {
  const expectation = (src: string): void => {
    expect(src).toContain('conversations.sync().catch(() => undefined)');
    expect(src).toContain('members.length >= 2');
    expect(src).toContain('repairDmMembership(convId: string, address: string): Promise<boolean>');
  };
  test('web seam', () => { expectation(webSeam); });
  test('native seam', () => { expectation(nativeSeam); });
  test('native repair actually adds the peer back', () => {
    expect(nativeSeam).toContain('addGroupMembers(');
  });
  test('both seams export the same findExistingDmWithAddress surface', () => {
    const sig = 'export async function findExistingDmWithAddress(address: string): Promise<ExistingDm | null>';
    expect(webSeam).toContain(sig);
    expect(nativeSeam).toContain(sig);
  });
  test('both seams classify through the shared evidence core', () => {
    for (const src of [webSeam, nativeSeam]) {
      expect(src).toContain('classifyKeyPackageStatuses([...statuses.values()].map(s => s.validationError))');
      expect(src).toContain("verdict === 'stale-installations' ? 'stale-installations' : null");
    }
  });
});
