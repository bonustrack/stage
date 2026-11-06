import { useState } from 'react';
import { useActiveAccountRecord } from '../../lib/messaging/account';
import { getPeerHandle } from '../../lib/peerProfiles';
import { capabilities } from '../../lib/capabilities';
import { settingsSection } from '../settings/settingsCatalog.model';
import { EditProfileModal } from './EditProfileModal';

interface EditProfile {
  editable: boolean;
  open: () => void;
  modal: React.ReactElement | null;
}

export function useEditProfile(allowed: boolean): EditProfile {
  const address = useActiveAccountRecord()?.address ?? null;
  const handle = getPeerHandle(address);
  const [editing, setEditing] = useState(false);
  const target = allowed && address !== null && handle ? { address, handle } : null;
  const open = (): void => {
    if (target) setEditing(true);
    else capabilities.navigate(settingsSection('profile').href);
  };
  const modal = target ? (
    <EditProfileModal
      visible={editing}
      onClose={() => {
        setEditing(false);
      }}
      address={target.address}
      handle={target.handle}
    />
  ) : null;
  return { editable: target !== null, open, modal };
}
