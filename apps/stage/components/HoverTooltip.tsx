import type { ReactNode, Ref } from 'react';
import type { RenderedNode } from './layout/webChrome';
import type { Shortcut } from './keys/keys.model';

export function HoverTooltip({
  children,
}: {
  label: string;
  children: ReactNode;
  placement?: 'beside' | 'above' | 'below';
  shortcut?: Shortcut;
  nodeRef?: Ref<RenderedNode>;
}): React.ReactElement {
  return <>{children}</>;
}
