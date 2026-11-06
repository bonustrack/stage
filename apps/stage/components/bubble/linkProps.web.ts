import { NEW_TAB, isPlainClick } from '@stage-labs/kit/link';
import { internalLinkPath } from '@stage-labs/client/routing/deepLinks';
import { isAllowedLinkScheme, isStageSchemeUrl, shareUrlFor } from '@stage-labs/client/routing/stageLinks';
import type { BubbleLinkProps, LinkPress } from './helpers';

function stopPropagation(event: Event): void {
  event.stopPropagation();
}

function keepBrowserContextMenu(node: unknown): void {
  if (node instanceof HTMLElement) node.addEventListener('contextmenu', stopPropagation);
}

export function bubbleLinkProps(url: string, onLinkPress: LinkPress): BubbleLinkProps {
  if (!isAllowedLinkScheme(url))
    return {
      onPress: () => {
        onLinkPress?.(url);
      },
    };
  const path = internalLinkPath(url);
  if (!path) return { href: url, hrefAttrs: NEW_TAB, accessibilityRole: 'link', onPress: undefined, ref: keepBrowserContextMenu };
  return {
    href: isStageSchemeUrl(url) ? shareUrlFor(path) : url,
    hrefAttrs: undefined,
    accessibilityRole: 'link',
    onPress: (event) => {
      if (!isPlainClick(event)) return;
      event?.preventDefault();
      onLinkPress?.(url);
    },
    ref: keepBrowserContextMenu,
  };
}
