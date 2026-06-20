
export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

export function lineOfConv(convId: string): string {
  return `metro://xmtp/${convId}`;
}

export function lineOfDmPeer(address: string): string {
  return `${XMTP_USER_PREFIX}${address}`;
}

const LINK_PREFIX =
  '(?:(?:metro|stage):\\/\\/' +
  '|https?:\\/\\/(?:metro|stage)\\.box\\/(?:#\\/)?)';

export function metroDmPeerOf(text?: string | null): string | null {
  if (!text) return null;
  const m = new RegExp(LINK_PREFIX + '(?:xmtp\\/)?user\\/(0x[a-fA-F0-9]{40})').exec(text);
  return m?.[1] ?? null;
}

export function convIdOfLine(line: string): string | null {
  const m = /^metro:\/\/xmtp\/([^/]+)$/.exec(line);
  return m?.[1] ?? null;
}

export function metroConvIdOf(text?: string | null): string | null {
  if (!text) return null;
  const m = new RegExp(LINK_PREFIX + 'xmtp\\/(?!user\\/)([^\\s/?#]+)').exec(text);
  return m?.[1] ?? null;
}
