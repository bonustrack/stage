export const XMTP_USER_PREFIX = 'stage://xmtp/user/';

export function lineOfConv(convId: string): string {
  return `stage://xmtp/${convId}`;
}

export function lineOfDmPeer(address: string): string {
  return `${XMTP_USER_PREFIX}${address}`;
}

const LINK_PREFIX =
  '(?:(?:metro|stage):\\/\\/' +
  '|https?:\\/\\/stage\\.box\\/(?:#\\/)?)';

const DM_PEER_RE = new RegExp(
  LINK_PREFIX + '(?:xmtp\\/)?(?:user\\/)?(0x[a-fA-F0-9]{40})(?![a-fA-F0-9])',
);
const CONV_ID_RE = new RegExp(
  LINK_PREFIX + '(?:xmtp\\/|channel\\/)(?!user\\/)([^\\s/?#]+)',
);

export function stageDmPeerOf(text?: string | null): string | null {
  if (!text) return null;
  const m = DM_PEER_RE.exec(text);
  return m?.[1] ?? null;
}

export function convIdOfLine(line: string): string | null {
  const m = /^(?:metro|stage):\/\/xmtp\/([^/]+)$/.exec(line);
  return m?.[1] ?? null;
}

export function stageConvIdOf(text?: string | null): string | null {
  if (!text) return null;
  const m = CONV_ID_RE.exec(text);
  return m?.[1] ?? null;
}
