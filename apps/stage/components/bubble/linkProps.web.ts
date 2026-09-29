import { isAllowedLinkScheme } from '../../lib/safeOpenLink';
import type { BubbleLinkProps, LinkPress } from './helpers';

const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

function stopPropagation(event: Event): void {
  event.stopPropagation();
}

function keepBrowserContextMenu(node: unknown): void {
  if (node instanceof HTMLElement) node.addEventListener('contextmenu', stopPropagation);
}

export function bubbleLinkProps(url: string, onLinkPress: LinkPress): BubbleLinkProps {
  if (!isAllowedLinkScheme(url)) return { onPress: () => { onLinkPress?.(url); } };
  return { href: url, hrefAttrs: NEW_TAB, onPress: undefined, ref: keepBrowserContextMenu };
}
