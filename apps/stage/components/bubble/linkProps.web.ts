import { stageChannelIdOf } from '@stage-labs/client/xmtp/line';
import { isAllowedLinkScheme, openInBubbleLink } from '../../lib/safeOpenLink';
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
  if (!stageChannelIdOf(url)) return { href: url, hrefAttrs: NEW_TAB, onPress: undefined, ref: keepBrowserContextMenu };
  return {
    href: url.replace(/^(?:metro|stage):\/\/(?:xmtp|channel)\//i, 'https://stage.box/#/channel/'),
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
