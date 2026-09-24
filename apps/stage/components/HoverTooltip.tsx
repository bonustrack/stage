import type { ReactNode } from 'react';

export function HoverTooltip({ children }: {
  label: string; children: ReactNode; placement?: 'beside' | 'above' | 'below';
}): React.ReactElement {
  return <>{children}</>;
}
