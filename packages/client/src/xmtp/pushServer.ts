import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import { hexToBytes, type Hex } from 'viem';
import { stableOwnerSignature } from '../accounts/keys';
import { bytesToBase64 } from '../text/base64';

export const PUSH_RPC = {
  register: 'RegisterInstallation',
  subscribe: 'SubscribeWithMetadata',
  remove: 'DeleteInstallation',
  join: 'JoinDeviceGroup',
  clear: 'ClearConversation',
} as const;

export type PushRpc = (typeof PUSH_RPC)[keyof typeof PUSH_RPC];

const XMTP_SERVICE = 'notifications.v1.Notifications';
const STAGE_SERVICE = 'stage.v1.Push';

const RPC_SERVICE: Record<PushRpc, string> = {
  RegisterInstallation: XMTP_SERVICE,
  SubscribeWithMetadata: XMTP_SERVICE,
  DeleteInstallation: XMTP_SERVICE,
  JoinDeviceGroup: STAGE_SERVICE,
  ClearConversation: STAGE_SERVICE,
};

export function isPushRpc(method: string): method is PushRpc {
  return Object.hasOwn(RPC_SERVICE, method);
}

export function pushRpcPath(method: PushRpc): string {
  return `/${RPC_SERVICE[method]}/${method}`;
}

export type PushPlatform = 'android' | 'ios' | 'web';

export interface HmacKeyData {
  thirtyDayPeriodsSinceEpoch: number;
  hmacKey: Uint8Array;
}

export type HmacKeysByTopic = Record<string, readonly HmacKeyData[] | undefined>;

export interface PushSubscriptionJson {
  topic: string;
  hmacKeys: { thirtyDayPeriodsSinceEpoch: number; key: string }[];
  isSilent: boolean;
}

export function registerInstallationBody(installationId: string, token: string, platform: PushPlatform): {
  installationId: string;
  deliveryMechanism: { firebaseDeviceToken: string } | { apnsDeviceToken: string };
  payloadFormat: 'PAYLOAD_FORMAT_V3';
} {
  return {
    installationId,
    deliveryMechanism: platform === 'ios' ? { apnsDeviceToken: token } : { firebaseDeviceToken: token },
    payloadFormat: 'PAYLOAD_FORMAT_V3',
  };
}

export function subscribeWithMetadataBody(
  installationId: string,
  topics: readonly string[],
  hmacKeys: HmacKeysByTopic,
  isSilent: (topic: string) => boolean,
): { installationId: string; subscriptions: PushSubscriptionJson[] } {
  const subscriptions = topics.map((topic) => ({
    topic,
    hmacKeys: (hmacKeys[topic] ?? []).map((k) => ({
      thirtyDayPeriodsSinceEpoch: k.thirtyDayPeriodsSinceEpoch,
      key: bytesToBase64(k.hmacKey),
    })),
    isSilent: isSilent(topic),
  }));
  return { installationId, subscriptions };
}

export function deleteInstallationBody(installationId: string): { installationId: string } {
  return { installationId };
}

const GROUP_TOPIC = /\/g-([0-9a-fA-F]+)\//;

export function groupIdOfTopic(topic: string): string | null {
  const match = GROUP_TOPIC.exec(topic);
  return match?.[1]?.toLowerCase() ?? null;
}

export function isWelcomeTopic(topic: string): boolean {
  return topic.includes('/w-');
}

export function groupTopicOf(groupId: string): string {
  return `/xmtp/mls/1/g-${groupId}/proto`;
}

const CLEAR_TOPIC_PREFIX = '/stage/clear/';
const CLEARED_CONV = /^[0-9a-f]+$/;

export function clearedConvOfTopic(topic: string | null | undefined): string | null {
  if (typeof topic !== 'string' || !topic.startsWith(CLEAR_TOPIC_PREFIX)) return null;
  const convId = topic.slice(CLEAR_TOPIC_PREFIX.length).toLowerCase();
  return CLEARED_CONV.test(convId) ? convId : null;
}

export function pushGroupKeyMessage(address: string): string {
  return `stage.box push device group v1 for ${address.toLowerCase()}`;
}

export async function derivePushGroupKey(address: string, signOwnerMessage: (message: string) => Promise<Hex>): Promise<string> {
  const signature = await stableOwnerSignature(pushGroupKeyMessage(address), signOwnerMessage);
  return bytesToHex(sha256(hexToBytes(signature)));
}

export function joinDeviceGroupBody(installationId: string, groupKey: string): { installationId: string; groupKey: string } {
  return { installationId, groupKey };
}

export function clearConversationBody(installationId: string, groupKey: string, convId: string): {
  installationId: string;
  groupKey: string;
  topic: string;
} {
  return { installationId, groupKey, topic: groupTopicOf(convId) };
}
