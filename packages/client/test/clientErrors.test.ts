import { describe, expect, test } from 'bun:test';
import {
  CHANNEL_WAITING_NOTICE, INACTIVE_SEND_MESSAGE, classifyKeyPackageStatuses, isGroupInactive, isMissingMlsState,
  pickNativeErrors, readableSendError,
} from '../src/xmtp/clientErrors';
import { errorLine } from '../src/errors';

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

const NATIVE_LOG = [
  '2026-10-03T12:40:01.123Z  INFO xmtp_mls::client: syncing welcomes',
  '2026-10-03T12:40:01.456Z ERROR xmtp_mls::groups: openmls error while loading group SerializationError',
  '2026-10-03T12:40:01.789Z ERROR xmtp_api: request timed out',
  '',
].join('\n');

describe('pickNativeErrors', () => {
  test('prefers the group loading error, without its timestamp and level', () => {
    expect(pickNativeErrors(NATIVE_LOG)).toBe('xmtp_mls::groups: openmls error while loading group SerializationError');
  });

  test('falls back to the last error lines when no group load failed', () => {
    const log = ['x ERROR one', 'y ERROR two', 'z ERROR three', 'w ERROR four', 'v INFO five'].join('\n');
    expect(pickNativeErrors(log)).toBe('two | three | four');
  });

  test('an empty or quiet log gives an empty string', () => {
    expect(pickNativeErrors('')).toBe('');
    expect(pickNativeErrors('Cannot read file: /x (exists: false, canRead: false)')).toBe('');
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

describe('errorLine', () => {
  test('keeps the first line of an error and falls back for anything else', () => {
    expect(errorLine(new Error('Gas too low\nat call 2'))).toBe('Gas too low');
    expect(errorLine('plain text')).toBe('plain text');
    expect(errorLine({ code: 4 }, 'Could not save.')).toBe('Could not save.');
  });
});
