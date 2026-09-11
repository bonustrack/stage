export const PUSH_RPC = {
  register: '/notifications.v1.Notifications/RegisterInstallation',
  subscribe: '/notifications.v1.Notifications/SubscribeWithMetadata',
  remove: '/notifications.v1.Notifications/DeleteInstallation',
} as const;

export type PushPlatform = 'android' | 'ios';

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

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function byteAt(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? 0;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const padded = new Uint8Array(Math.ceil(bytes.length / 3) * 3);
  padded.set(bytes);
  let out = '';
  for (let i = 0; i < padded.length; i += 3) {
    const triple = (byteAt(padded, i) << 16) | (byteAt(padded, i + 1) << 8) | byteAt(padded, i + 2);
    out += BASE64.charAt((triple >> 18) & 63);
    out += BASE64.charAt((triple >> 12) & 63);
    out += BASE64.charAt((triple >> 6) & 63);
    out += BASE64.charAt(triple & 63);
  }
  const pad = padded.length - bytes.length;
  return pad === 0 ? out : `${out.slice(0, out.length - pad)}${'='.repeat(pad)}`;
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
