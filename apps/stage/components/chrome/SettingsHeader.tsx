import { SETTINGS_ROUTE } from '../../lib/routes';
import { StackHeader } from './StackHeader';

export function SettingsHeader({ title }: { title: string }): React.ReactElement {
  return <StackHeader title={title} backTo={SETTINGS_ROUTE} />;
}
