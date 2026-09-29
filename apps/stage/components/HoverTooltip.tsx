import type { ReactNode } from 'react';
import type { Shortcut } from './shortcuts.model';

export function HoverTooltip({ children }: {
  label: string; children: ReactNode; placement?: 'beside' | 'above' | 'below'; shortcut?: Shortcut; onShortcut?: () => void;
}): React.ReactElement {
  return <>{children}</>;
}
