import { describe, expect, test } from 'bun:test';
import {
  bytesToBase64, deleteInstallationBody, groupIdOfTopic, isWelcomeTopic, registerInstallationBody,
  subscribeWithMetadataBody,
} from '../src/xmtp/pushServer';

describe('bytesToBase64', () => {
  test('matches the standard encoding including padding', () => {
    const cases: [string, string][] = [['', ''], ['f', 'Zg=='], ['fo', 'Zm8='], ['foo', 'Zm9v'], ['foob', 'Zm9vYg==']];
    for (const [input, expected] of cases) {
      expect(bytesToBase64(new TextEncoder().encode(input))).toBe(expected);
    }
  });
});

describe('request bodies', () => {
  test('registers with the token field matching the platform', () => {
    expect(registerInstallationBody('inst', 'tok', 'android')).toEqual({
      installationId: 'inst', deliveryMechanism: { firebaseDeviceToken: 'tok' }, payloadFormat: 'PAYLOAD_FORMAT_V3',
    });
    expect(registerInstallationBody('inst', 'tok', 'ios').deliveryMechanism).toEqual({ apnsDeviceToken: 'tok' });
  });

  test('subscribes every topic with its base64 keys and a silent flag', () => {
    const body = subscribeWithMetadataBody(
      'inst',
      ['/xmtp/mls/1/g-abc/proto', '/xmtp/mls/1/w-inst/proto'],
      { '/xmtp/mls/1/g-abc/proto': [{ thirtyDayPeriodsSinceEpoch: 700, hmacKey: new Uint8Array([1, 2, 3]) }] },
      (topic) => topic.includes('g-abc'),
    );
    expect(body).toEqual({
      installationId: 'inst',
      subscriptions: [
        { topic: '/xmtp/mls/1/g-abc/proto', hmacKeys: [{ thirtyDayPeriodsSinceEpoch: 700, key: 'AQID' }], isSilent: true },
        { topic: '/xmtp/mls/1/w-inst/proto', hmacKeys: [], isSilent: false },
      ],
    });
    expect(deleteInstallationBody('inst')).toEqual({ installationId: 'inst' });
  });
});

describe('topics', () => {
  test('extracts the group id and recognises welcome topics', () => {
    expect(groupIdOfTopic('/xmtp/mls/1/g-ABCdef01/proto')).toBe('abcdef01');
    expect(groupIdOfTopic('/xmtp/mls/1/w-installation/proto')).toBeNull();
    expect(isWelcomeTopic('/xmtp/mls/1/w-installation/proto')).toBe(true);
    expect(isWelcomeTopic('/xmtp/mls/1/g-abc/proto')).toBe(false);
  });
});
