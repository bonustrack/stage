
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const read = (...p: string[]) => readFileSync(join(APP_ROOT, ...p), 'utf8');

const hooksSrc = read('app', '(conv)', 'conv.hooks.ts');
const webSeam = read('lib', 'xmtp.conv.web.ts');
const nativeSeam = read('lib', 'xmtp.conv.ts');
const screenSrc = read('app', '(conv)', '[convId].tsx');

describe('address-routed DM opening never mints or masks a peer-less stub DM', () => {
  test('existing DM with the peer joined wins before anything else', () => {
    const lookupIdx = hooksSrc.indexOf('findExistingDmWithAddress(address)');
    const joinedIdx = hooksSrc.indexOf('existing?.peerJoined');
    const createIdx = hooksSrc.indexOf('openDmWithAddress(address)');
    expect(lookupIdx).toBeGreaterThanOrEqual(0);
    expect(joinedIdx).toBeGreaterThan(lookupIdx);
    expect(createIdx).toBeGreaterThan(joinedIdx);
  });
  test('a stub DM is repaired or surfaced as unreachable, never opened as-is', () => {
    expect(hooksSrc).toContain('if (existing) return resolveStubDm(existing.convId, address)');
    expect(hooksSrc).toContain('repairDmMembership(convId, address)');
  });
  test('reachability is probed BEFORE the first create so a failed create cannot plant a stub', () => {
    const probeIdx = hooksSrc.indexOf('const reason = await dmUnreachableReason(address)');
    const createIdx = hooksSrc.indexOf('await openDmWithAddress(address)');
    expect(probeIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThan(probeIdx);
  });
  test('there is no blind createDm retry (it would silently return the stub)', () => {
    expect(hooksSrc).not.toContain('CREATE_RETRY_DELAY_MS');
    const first = hooksSrc.indexOf('openDmWithAddress(address)');
    const last = hooksSrc.lastIndexOf('openDmWithAddress(address)');
    expect(first).toBe(last);
  });
  test('the error screen offers a retry, it is not terminal', () => {
    expect(hooksSrc).toContain('retry: () => void');
    expect(screenSrc).toContain('onPress={resolved.retry}');
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
});

describe('dmUnreachableReason claims expired keys only with positive evidence', () => {
  const expectation = (src: string): void => {
    expect(src).toContain('classifyKeyPackageStatuses([...statuses.values()].map(s => s.validationError))');
    expect(src).toContain("verdict === 'stale-installations' ? 'stale-installations' : null");
  };
  test('web seam classifies through the shared evidence core', () => {
    expectation(webSeam);
  });
  test('native seam classifies through the shared evidence core', () => {
    expectation(nativeSeam);
  });
  test('both seams export the same findExistingDmWithAddress surface', () => {
    const sig = 'export async function findExistingDmWithAddress(address: string): Promise<ExistingDm | null>';
    expect(webSeam).toContain(sig);
    expect(nativeSeam).toContain(sig);
  });
});
