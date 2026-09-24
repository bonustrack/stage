import { useState } from 'react';
import { OverflowMenu } from './MenuRows';
import { capabilities } from '../lib/capabilities';
import { profileMenuItems } from './ProfileScreen.model';
import { EditProfileModal } from './settings/EditProfileModal';
import { useActiveAccountRecord } from '../modules/messaging';
import { getPeerHandle } from '../lib/peerProfiles';

export function ProfileMenu({ color, isSelf }: { color: string; isSelf: boolean }): React.ReactElement | null {
  const items = profileMenuItems(isSelf);
  const address = useActiveAccountRecord()?.address ?? null;
  const handle = getPeerHandle(address);
  const [editing, setEditing] = useState(false);
  if (items.length === 0) return null;
  const onEdit = (): void => {
    if (address && handle) setEditing(true);
    else capabilities.navigate('/settings/profile');
  };
  return (
    <>
      <OverflowMenu color={color} items={items} onSelect={(id) => { if (id === 'edit') onEdit(); }} />
      {address && handle ? (
        <EditProfileModal visible={editing} onClose={() => { setEditing(false); }} address={address} handle={handle} />
      ) : null}
    </>
  );
}
