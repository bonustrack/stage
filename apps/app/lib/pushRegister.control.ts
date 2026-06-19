/** @file Control-DM wire format shared with the daemon: the `METRO_CTRL:` prefix, register/disable-push body builders, and the `isMetroControlBody` filter used to hide control DMs from chat UI. */

/*
 * Control-DM wire format shared with the daemon train. Extracted from pushRegister.ts (mechanical split, behavior identical). See pushRegister.ts header for the full CONTROL-DM WIRE FORMAT contract. */

/** The daemon's XMTP identity (the `tony` daemon wallet) — the inbox the control DM is sent to. Same address used for the "Ask a question" group co-member. */
export const DAEMON_INBOX_ADDRESS = '0x0bA043c6F25085C68042bad079c29bD8f16a651A';

/** Magic prefix marking a plain-text XMTP message as a private control payload rather than a chat message. The daemon parses the same prefix. */
const METRO_CTRL_PREFIX = 'METRO_CTRL:';

/** The control-DM verb for push registration. Full body = `${METRO_CTRL_PREFIX}${CTRL_REGISTER_PUSH}:${json}`. */
const CTRL_REGISTER_PUSH = 'register-push';

/** The control-DM verb asking the daemon to STOP pushing to this device's token (user turned push OFF in Settings → Notifications). Full body = `${METRO_CTRL_PREFIX}${CTRL_DISABLE_PUSH}:${json}`. */
const CTRL_DISABLE_PUSH = 'disable-push';

/** Bump when the JSON shape below changes so the daemon can branch on `v`. */
const CTRL_SCHEMA_VERSION = 1;

/** Detect the magic-prefixed control body so the app filters these control DMs out of previews / rows / notifications. Kept deliberately broad (prefix only) so any future control verb is suppressed too. */
export function isMetroControlBody(text: unknown): boolean {
  return typeof text === 'string' && text.startsWith(METRO_CTRL_PREFIX);
}

/** Build the exact control-DM body the daemon will parse. Exposed for tests / the daemon side to share a single source of truth on the wire format. */
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

/** Build the control-DM body telling the daemon to drop this device's token (push turned OFF). The daemon removes `{token}` from the account's push set. */
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
