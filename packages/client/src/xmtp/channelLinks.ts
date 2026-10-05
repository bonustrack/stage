export const MARKDOWN_LINK_RE = /\[([^[\]\n]+)\]\(((?:[^\s()]|\([^\s()]*\))+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^\)\n]*\)))?\)/g;

export function channelLinkText(meta: { groupName?: string | null; peerAddress?: string | null }, label?: string, url?: string, text?: string): string {
  return meta.peerAddress ? text ?? url ?? channelLinkLabel(undefined, label) : channelLinkLabel(meta.groupName, label);
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
