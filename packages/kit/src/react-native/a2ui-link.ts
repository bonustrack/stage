import { Platform } from 'react-native';
import { checkedUrl } from '../a2ui/functions';
import { isFunctionAction } from '../a2ui/protocol';
import { NEW_TAB, isPlainClick, type LinkClickEvent } from '../link';
import type { RenderContext } from './a2ui-context';

export interface A2uiLinkProps {
  href: string;
  hrefAttrs: typeof NEW_TAB;
  accessibilityRole: 'link';
  onPress: (event?: LinkClickEvent) => void;
}

function openUrlTarget(ctx: RenderContext): string | undefined {
  const action = ctx.instance.action;
  if (!isFunctionAction(action) || action.functionCall['@call'] !== 'openUrl') return undefined;
  try {
    return checkedUrl(ctx.resolve(action.functionCall.args?.url));
  } catch {
    return undefined;
  }
}

export function a2uiLinkProps(ctx: RenderContext, press: () => void): A2uiLinkProps | undefined {
  const href = Platform.OS === 'web' && !ctx.disabled ? openUrlTarget(ctx) : undefined;
  if (href === undefined) return undefined;
  return {
    href,
    hrefAttrs: NEW_TAB,
    accessibilityRole: 'link',
    onPress: (event) => {
      if (!isPlainClick(event)) return;
      event?.preventDefault();
      press();
    },
  };
}
