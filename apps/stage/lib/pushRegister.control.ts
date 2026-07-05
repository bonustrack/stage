

export const DAEMON_INBOX_ADDRESS = '0x0bA043c6F25085C68042bad079c29bD8f16a651A';

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
