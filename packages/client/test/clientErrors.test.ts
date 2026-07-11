import { describe, expect, test } from 'bun:test';
import { classifyKeyPackageStatuses } from '../src/xmtp/clientErrors';

const LIFETIME = 'mls validation: The lifetime of the leaf node is not valid';

describe('classifyKeyPackageStatuses', () => {
  test('any valid key package means the peer is reachable', () => {
    expect(classifyKeyPackageStatuses([undefined, LIFETIME])).toBe('reachable');
    expect(classifyKeyPackageStatuses([''])).toBe('reachable');
    expect(classifyKeyPackageStatuses([null])).toBe('reachable');
  });

  test('all lifetime-expired key packages means stale installations', () => {
    expect(classifyKeyPackageStatuses([LIFETIME])).toBe('stale-installations');
    expect(classifyKeyPackageStatuses([LIFETIME, 'KeyPackage expired'])).toBe('stale-installations');
    expect(classifyKeyPackageStatuses(['key package not found', 'no key package'])).toBe(
      'stale-installations',
    );
  });

  test('non-expiry failures are indeterminate, never reported as expired keys', () => {
    expect(classifyKeyPackageStatuses(['grpc stream closed'])).toBe('indeterminate');
    expect(classifyKeyPackageStatuses(['network error', LIFETIME])).toBe('indeterminate');
    expect(classifyKeyPackageStatuses(['deserialization failure'])).toBe('indeterminate');
  });

  test('no evidence at all is indeterminate', () => {
    expect(classifyKeyPackageStatuses([])).toBe('indeterminate');
  });
});
