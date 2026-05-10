// `<platform>:<chat>[/<message_id>]` — the wire format of every metro
// inbound `to` field, and the only address shape any subcommand accepts.

export type Platform = 'telegram' | 'discord';
export type Address = { platform: Platform; chat: string; messageId?: string };

export function formatAddress(addr: Address): string {
  return addr.messageId === undefined
    ? `${addr.platform}:${addr.chat}`
    : `${addr.platform}:${addr.chat}/${addr.messageId}`;
}

export function parseAddress(to: string, requireMessage: boolean): Address {
  const colon = to.indexOf(':');
  if (colon === -1) {
    throw new Error(`invalid --to (expected '<platform>:<chat>[/<message_id>]'): ${to}`);
  }
  const platform = to.slice(0, colon);
  if (platform !== 'telegram' && platform !== 'discord') {
    throw new Error(`unknown platform '${platform}' in --to (expected 'telegram' or 'discord')`);
  }
  const rest = to.slice(colon + 1);
  const slash = rest.indexOf('/');
  const chat = slash === -1 ? rest : rest.slice(0, slash);
  const messageId = slash === -1 ? undefined : rest.slice(slash + 1);
  if (!chat) throw new Error(`empty chat/channel id in --to: ${to}`);
  if (requireMessage && !messageId) throw new Error(`--to must include /<message_id>: ${to}`);
  return { platform, chat, messageId };
}
