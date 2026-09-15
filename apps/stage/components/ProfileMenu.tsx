import { OverflowMenu } from './MenuRows';
import { capabilities } from '../lib/capabilities';
import { profileMenuItems } from './ProfileScreen.model';

export function ProfileMenu({ color, isSelf }: { color: string; isSelf: boolean }): React.ReactElement | null {
  const items = profileMenuItems(isSelf);
  if (items.length === 0) return null;
  return (
    <OverflowMenu color={color} items={items}
      onSelect={(id) => { if (id === 'edit') capabilities.navigate('/settings/profile'); }} />
  );
}
