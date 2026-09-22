import type { ReactNode } from 'react';
import { SETTINGS_ROUTE } from '../../lib/routes';
import { StackHeader } from './StackHeader';

export function SettingsHeader({ title, trailing }: {
  title: string;
  trailing?: ReactNode;
}): React.ReactElement {
  return <StackHeader title={title} trailing={trailing} backTo={SETTINGS_ROUTE} />;
}
