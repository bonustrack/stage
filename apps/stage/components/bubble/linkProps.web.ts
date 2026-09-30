import { internalLinkPath, isAllowedLinkScheme, openInBubbleLink } from '../../lib/safeOpenLink';
import type { BubbleLinkEvent, BubbleLinkProps, LinkPress } from './helpers';

const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

function stopPropagation(event: Event): void {
  event.stopPropagation();
}

function keepBrowserContextMenu(node: unknown): void {
  if (node instanceof HTMLElement) node.addEventListener('contextmenu', stopPropagation);
}

function shouldRoute(event?: BubbleLinkEvent): boolean {
  if (!event) return true;
  return !event.defaultPrevented && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey
    && (event.button === undefined || event.button === 0);
}

export function bubbleLinkProps(url: string, onLinkPress: LinkPress): BubbleLinkProps {
  if (!isAllowedLinkScheme(url)) return { onPress: () => { onLinkPress?.(url); } };
  const path = internalLinkPath(url);
  if (!path) return { href: url, hrefAttrs: NEW_TAB, onPress: undefined, ref: keepBrowserContextMenu };
  return {
    href: /^(?:metro|stage):\/\//i.test(url.trim()) ? `https://stage.box/#${path}` : url,
    hrefAttrs: undefined,
    accessibilityRole: 'link',
    onPress: event => {
      if (!shouldRoute(event)) return;
      event?.preventDefault();
      (onLinkPress ?? openInBubbleLink)(url);
    },
    ref: keepBrowserContextMenu,
  };
}
