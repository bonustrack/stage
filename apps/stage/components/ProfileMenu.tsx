import { useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { RoundOverflowMenu } from './MenuRows';
import { capabilities } from '../lib/capabilities';
import { PEER_PROFILE_MENU } from './ProfileScreen.model';
import { EditProfileModal } from './settings/EditProfileModal';
import { useActiveAccountRecord } from '../modules/messaging';
import { getPeerHandle } from '../lib/peerProfiles';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';

const CENTERED = { alignSelf: 'center' } as const;

function EditProfileButton({ background }: { background: string }): React.ReactElement {
  const address = useActiveAccountRecord()?.address ?? null;
  const handle = getPeerHandle(address);
  const dark = useEffectiveColorScheme() === 'dark';
  const [editing, setEditing] = useState(false);
  const onEdit = (): void => {
    if (address && handle) setEditing(true);
    else capabilities.navigate('/settings/profile');
  };
  return (
    <>
      <Button label="Edit profile" color="secondary" variant="solid" dark={dark} tintBg={background} tintPressedBg={background} style={{ ...CENTERED, borderColor: background }} onPress={onEdit} />
      {address && handle ? (
        <EditProfileModal visible={editing} onClose={() => { setEditing(false); }} address={address} handle={handle} />
      ) : null}
    </>
  );
}

export function ProfileMenu({ isSelf, onSelect }: { isSelf: boolean; onSelect: (id: string) => void }): React.ReactElement {
  const { bg } = usePalette();
  if (isSelf) return <EditProfileButton background={bg} />;
  return <RoundOverflowMenu items={PEER_PROFILE_MENU} onSelect={onSelect} background={bg} />;
}
