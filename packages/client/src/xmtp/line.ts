import { routeForUrl } from '../routing/deepLinks';

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

export function stageDmPeerOf(text?: string | null): string | null {
  if (!text) return null;
  const m = DM_PEER_RE.exec(text);
  return m?.[1] ?? null;
}

export function convIdOfLine(line: string): string | null {
  const m = /^(?:metro|stage):\/\/xmtp\/([^/]+)$/.exec(line);
  return m?.[1] ?? null;
}

const CHANNEL_LINK_RE = new RegExp(
  '^' + LINK_PREFIX + '(?:xmtp|channel)\\/[A-Za-z0-9_-]+\\/?(?:\\?[^\\s<>#]*)?$', 'i',
);

export function stageChannelIdOf(url: string): string | null {
  if (!CHANNEL_LINK_RE.test(url) || /[.,;:!?)\]}'"`>]+$/.test(url) || stageDmPeerOf(url)) return null;
  const route = routeForUrl(url);
  return route?.pathname === '/channel/[convId]' ? route.params.convId : null;
}
