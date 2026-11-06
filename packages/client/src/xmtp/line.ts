import { routeForUrl } from '../routing/deepLinks';
import { STAGE_LINK_START, STAGE_SCHEMES, appUrlFor, hasTrailingPunctuation } from '../routing/stageLinks';

export const XMTP_USER_PREFIX = appUrlFor('/xmtp/user/');

export function lineOfConv(convId: string): string {
  return appUrlFor(`/xmtp/${convId}`);
}

export function lineOfDmPeer(address: string): string {
  return `${XMTP_USER_PREFIX}${address}`;
}

const DM_PEER_RE = new RegExp(STAGE_LINK_START + '(?:xmtp\\/)?(?:user\\/)?(0x[a-fA-F0-9]{40})(?![a-fA-F0-9])');

export function stageDmPeerOf(text?: string | null): string | null {
  if (!text) return null;
  const m = DM_PEER_RE.exec(text);
  return m?.[1] ?? null;
}

const LINE_RE = new RegExp(`^(?:${STAGE_SCHEMES.join('|')}):\\/\\/xmtp\\/([^/]+)$`);

export function convIdOfLine(line: string): string | null {
  const m = LINE_RE.exec(line);
  return m?.[1] ?? null;
}

const CHANNEL_LINK_RE = new RegExp('^' + STAGE_LINK_START + '(?:xmtp|channel)\\/[A-Za-z0-9_-]+\\/?(?:\\?[^\\s<>#]*)?$', 'i');

export function stageChannelIdOf(url: string): string | null {
  if (!CHANNEL_LINK_RE.test(url) || hasTrailingPunctuation(url) || stageDmPeerOf(url)) return null;
  const route = routeForUrl(url);
  return route?.pathname === '/channel/[convId]' ? route.params.convId : null;
}
