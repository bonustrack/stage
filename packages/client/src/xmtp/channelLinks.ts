import { stageChannelIdOf } from './line';

export const MARKDOWN_LINK_RE = /\[([^[\]\n]+)\]\(((?:[^\s()]|\([^\s()]*\))+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^\)\n]*\)))?\)/g;

export function singleChannelLinkOf(text: string): { url: string; convId: string } | null {
  const body = text.trim();
  const [markdown] = body.matchAll(MARKDOWN_LINK_RE);
  const url = markdown?.index === 0 && markdown[0].length === body.length ? markdown[2] ?? '' : body;
  const convId = stageChannelIdOf(url);
  return convId ? { url, convId } : null;
}

interface ChannelRow { convId: string; title?: unknown; groupName?: unknown; peerAddress?: unknown }

export function cachedChannelName(rows: readonly ChannelRow[] | null, convId: string): string | undefined {
  const row = rows?.find(r => r.convId === convId && r.peerAddress == null);
  return typeof row?.groupName === 'string' ? row.groupName : undefined;
}

export function channelLinkText(meta: { groupName?: string | null; peerAddr?: string | null }, label?: string, url?: string, text?: string): string {
  return meta.peerAddr ? text ?? url ?? channelLinkLabel(undefined, label) : channelLinkLabel(meta.groupName, label);
}

export function channelFallbackLabel(text: string): string | undefined {
  const label = text.trim().replace(/^(\*{1,3}|_{1,3})(#[\s\S]+)\1$/, '$2');
  return label.startsWith('#') ? label.slice(1) : undefined;
}

interface MarkdownTextNode { content: string; children: readonly MarkdownTextNode[] }

export function markdownLabelText(node: MarkdownTextNode): string {
  return node.children.length ? node.children.map(markdownLabelText).join('') : node.content;
}

export function channelLinkLabel(name?: string | null, fallback?: string): string {
  const clean = (value?: string | null): string => value?.trim().replace(/^#+\s*/, '') ?? '';
  return `#${clean(name) || clean(fallback) || 'channel'}`;
}
