

const RAW_ENV: Record<string, string | undefined> = {
  EXPO_PUBLIC_NOTIF_BRIDGE_INBOX: process.env.EXPO_PUBLIC_NOTIF_BRIDGE_INBOX as string | undefined,
};

export function getBridgeInboxAddress(): string | null {
  const value = RAW_ENV.EXPO_PUBLIC_NOTIF_BRIDGE_INBOX;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? trimmed : null;
}

const METRO_CTRL_PREFIX = 'METRO_CTRL:';

const CTRL_REGISTER_PUSH = 'register-push';

const CTRL_DISABLE_PUSH = 'disable-push';

const CTRL_SCHEMA_VERSION = 1;

export function isMetroControlBody(text: unknown): boolean {
  return typeof text === 'string' && text.startsWith(METRO_CTRL_PREFIX);
}

export function buildRegisterPushBody(payload: {
  token: string;
  platform: 'android' | 'ios';
  address: string;
  inboxId: string;
}): string {
  const json = JSON.stringify({
    v: CTRL_SCHEMA_VERSION,
    token: payload.token,
    platform: payload.platform,
    address: payload.address.toLowerCase(),
    inboxId: payload.inboxId,
  });
  return `${METRO_CTRL_PREFIX}${CTRL_REGISTER_PUSH}:${json}`;
}

export function buildDisablePushBody(payload: {
  token: string;
  address: string;
  inboxId: string;
}): string {
  const json = JSON.stringify({
    v: CTRL_SCHEMA_VERSION,
    token: payload.token,
    address: payload.address.toLowerCase(),
    inboxId: payload.inboxId,
  });
  return `${METRO_CTRL_PREFIX}${CTRL_DISABLE_PUSH}:${json}`;
}
