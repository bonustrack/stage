import { describe, expect, test } from 'bun:test';
import { serializeErc6492Signature } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  clearConversationBody, clearedConvOfTopic, deleteInstallationBody, derivePushGroupKey, groupIdOfTopic, isPushRpc,
  isWelcomeTopic, joinDeviceGroupBody, pushGroupKeyMessage, pushRpcPath, registerInstallationBody,
  subscribeWithMetadataBody,
} from '../src/xmtp/pushServer';

const OWNER = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const OTHER = privateKeyToAccount('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba');
const ADDRESS = '0x00000000000000000000000000000000000000A1';
const CONV = '0123456789abcdef0123456789abcdef';

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

describe('rpc routes', () => {
  test('keeps the XMTP methods on their service and the device group methods on Stage', () => {
    expect(pushRpcPath('RegisterInstallation')).toBe('/notifications.v1.Notifications/RegisterInstallation');
    expect(pushRpcPath('ClearConversation')).toBe('/stage.v1.Push/ClearConversation');
    expect(pushRpcPath('JoinDeviceGroup')).toBe('/stage.v1.Push/JoinDeviceGroup');
    expect(isPushRpc('DeleteInstallation')).toBe(true);
    expect(isPushRpc('Subscribe')).toBe(false);
    expect(isPushRpc('toString')).toBe(false);
  });
});

describe('clearing a conversation on the other devices', () => {
  test('asks to clear the conversation topic and nothing else', () => {
    expect(joinDeviceGroupBody('inst', 'key')).toEqual({ installationId: 'inst', groupKey: 'key' });
    expect(clearConversationBody('inst', 'key', CONV)).toEqual({
      installationId: 'inst', groupKey: 'key', topic: `/xmtp/mls/1/g-${CONV}/proto`,
    });
  });

  test('reads the cleared conversation only from a clear topic', () => {
    expect(clearedConvOfTopic(`/stage/clear/${CONV.toUpperCase()}`)).toBe(CONV);
    expect(clearedConvOfTopic(`/xmtp/mls/1/g-${CONV}/proto`)).toBeNull();
    expect(clearedConvOfTopic('/stage/clear/')).toBeNull();
    expect(clearedConvOfTopic('/stage/clear/not-hex')).toBeNull();
    expect(clearedConvOfTopic(null)).toBeNull();
    expect(groupIdOfTopic(`/stage/clear/${CONV}`)).toBeNull();
  });

  test('derives one group key per account, the same on every device', async () => {
    const sign = (message: string) => OWNER.signMessage({ message });
    const key = await derivePushGroupKey(ADDRESS, sign);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(await derivePushGroupKey(ADDRESS.toLowerCase(), sign)).toBe(key);
    expect(await derivePushGroupKey(ADDRESS, (message) => OTHER.signMessage({ message }))).not.toBe(key);
    expect(pushGroupKeyMessage(ADDRESS)).toBe(`stage.box push device group v1 for ${ADDRESS.toLowerCase()}`);
  });

  test('keeps the key when a smart account gets deployed', async () => {
    const deployed = (message: string) => OWNER.signMessage({ message });
    const undeployed = async (message: string) => serializeErc6492Signature({
      address: '0x00000000000000000000000000000000DeaDBeef', data: '0x1234', signature: await deployed(message),
    });
    expect(await derivePushGroupKey(ADDRESS, undeployed)).toBe(await derivePushGroupKey(ADDRESS, deployed));
  });

  test('refuses a signer that does not sign deterministically', async () => {
    let count = 0;
    const flaky = (message: string) => OWNER.signMessage({ message: `${message}${count++}` });
    await expect(derivePushGroupKey(ADDRESS, flaky)).rejects.toThrow('same signature twice');
  });
});
