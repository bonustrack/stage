import { describe, expect, test } from 'bun:test';
import {
  CHANNEL_WAITING_NOTICE, INACTIVE_SEND_MESSAGE, classifyKeyPackageStatuses, isGroupInactive, isMissingMlsState,
  readableSendError,
} from '../src/xmtp/clientErrors';

const NATIVE_INACTIVE = 'Call to function \'XMTP.sendMessage\' has been rejected. Caused by: '
  + 'uniffi.xmtpv3.FfiException$Exception: [GroupError::GroupInactive] Group error: Group is inactive';

describe('inactive conversations', () => {
  test('recognises the native and web inactive group errors', () => {
    expect(isGroupInactive(new Error(NATIVE_INACTIVE))).toBe(true);
    expect(isGroupInactive(new Error('Group is inactive'))).toBe(true);
    expect(isGroupInactive(new Error('network error'))).toBe(false);
  });

  test('maps an inactive send error to readable copy and leaves others alone', () => {
    const mapped = readableSendError(new Error(NATIVE_INACTIVE));
    expect(mapped.message).toBe(INACTIVE_SEND_MESSAGE);
    expect(INACTIVE_SEND_MESSAGE).not.toContain('Ffi');
    const other = new Error('boom');
    expect(readableSendError(other)).toBe(other);
    expect(readableSendError('plain').message).toBe('plain');
  });

  test('the waiting notice says how the device gets added', () => {
    expect(CHANNEL_WAITING_NOTICE).toContain('sends a message');
  });
});

const NATIVE_RESTORED = 'Call to function \'XMTP.findConversation\' has been rejected. \u2192 Caused by: '
  + 'uniffi.xmtpv3.FfiException$Exception: [NotFound::MlsGroup] Group error: MLS Group bb4e76e238f67034feae85db784edfd6 Not Found';

describe('restored copies without MLS state', () => {
  test('recognises the native and plain libxmtp errors', () => {
    expect(isMissingMlsState(new Error(NATIVE_RESTORED))).toBe(true);
    expect(isMissingMlsState(new Error('MLS Group bb4e76e2 Not Found'))).toBe(true);
    expect(isMissingMlsState('group error: MLS Group abc Not Found')).toBe(true);
  });

  test('leaves other lookup errors alone', () => {
    expect(isMissingMlsState(new Error(NATIVE_INACTIVE))).toBe(false);
    expect(isMissingMlsState(new Error('Group not found'))).toBe(false);
    expect(isMissingMlsState(new Error('network error'))).toBe(false);
  });
});

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
