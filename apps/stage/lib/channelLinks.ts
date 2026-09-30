import { stageChannelIdOf } from '@stage-labs/client/xmtp/line';

export const MARKDOWN_LINK_RE = /\[([^[\]\n]+)\]\(((?:[^\s()]|\([^\s()]*\))+)\)/g;

export function singleChannelLinkOf(text: string): { url: string; convId: string } | null {
  const body = text.trim();
  const [markdown] = body.matchAll(MARKDOWN_LINK_RE);
  const url = markdown?.index === 0 && markdown[0].length === body.length ? markdown[2] ?? '' : body;
  const convId = stageChannelIdOf(url);
  return convId ? { url, convId } : null;
}

interface ChannelRow { convId: string; title?: unknown; peerAddress?: unknown }

export function cachedChannelName(rows: readonly ChannelRow[] | null, convId: string): string | undefined {
  const row = rows?.find(r => r.convId === convId && r.peerAddress == null);
  return typeof row?.title === 'string' ? row.title : undefined;
}

export function channelLinkLabel(name?: string | null, fallback?: string): string {
  const clean = (value?: string | null): string => value?.trim().replace(/^#+\s*/, '') ?? '';
  return `#${clean(name) || clean(fallback) || 'channel'}`;
}
