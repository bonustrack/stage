import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useEffectiveColorScheme } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { useCopiedFlag } from '../../lib/useCopiedFlag';
import { getPeerHandle, getPeerName, getPeerProfileSource, invalidatePeerProfile, usePeerProfiles } from '../../lib/peerProfiles';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { Avatar } from '../Avatar';
import { SettingsPage } from './SettingsPage';
import { profileView, type ProfileView } from './ProfileSettings.model';
import { ClaimStageName } from './ProfileSettings.claim';
import { EditProfileModal } from './EditProfileModal';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Column, PAGE_GUTTER } from '../layout';

function CopyableAddress({ address }: { address: string }): React.ReactElement {
  const [copied, markCopied] = useCopiedFlag();
  const copy = (): void => {
    capabilities.copy('Address', address);
    markCopied();
  };
  return (
    <Pressable onPress={copy} hitSlop={8}>
      <Text text={copied ? 'Copied' : shortAddress(address)} size="xs" color="secondary" />
    </Pressable>
  );
}

function ProfileHeader({ address, name, handle, children }: {
  address: string | null; name: string | undefined; handle: string | undefined; children: React.ReactNode;
}): React.ReactElement {
  return (
    <Column align="center" gap={12} padding={{ y: 24 }}>
      {children}
      <Text text={name ?? (address ? shortAddress(address) : '')} size="md" fontWeight="semibold" />
      {handle && displayHandle(handle) !== name ? <Text size="md" variant="caption" text={displayHandle(handle)} color="secondary" /> : null}
      {address ? <CopyableAddress address={address} /> : null}
    </Column>
  );
}

function EditPane({ address, handle, view }: {
  address: string | null; handle: string | undefined; view: ProfileView;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [editing, setEditing] = useState(false);
  const name = getPeerName(address);
  const editable = address !== null && handle !== undefined && view.canChangePicture;
  return (
    <>
      <ProfileHeader address={address} name={name} handle={handle}>
        <Avatar address={address} size={96} />
      </ProfileHeader>
      {view.explanation === '' ? null : (
        <Column padding={{ x: PAGE_GUTTER, bottom: 12 }}>
          <Text text={view.explanation} size="xs" color="secondary" />
        </Column>
      )}
      {editable ? (
        <Column padding={{ x: PAGE_GUTTER, bottom: 16 }}>
          <Button label="Edit profile" block size="lg" color="secondary" variant="solid" dark={dark} onPress={() => { setEditing(true); }} />
          <EditProfileModal visible={editing} onClose={() => { setEditing(false); }} address={address} handle={handle} />
        </Column>
      ) : null}
    </>
  );
}

export function ProfileSettings(): React.ReactElement {
  const address = useActiveAccountRecord()?.address ?? null;
  usePeerProfiles([address]);
  const handle = getPeerHandle(address);
  const source = getPeerProfileSource(address);
  const view = profileView({ address, name: handle, source });

  return (
    <SettingsPage title="Profile">
      {address && view.claimVisible ? (
        <Column align="center" padding={{ top: 24, bottom: 16 }}>
          <ClaimStageName address={address} onClaimed={() => { invalidatePeerProfile(address); }} />
        </Column>
      ) : (
        <EditPane address={address} handle={handle} view={view} />
      )}
    </SettingsPage>
  );
}
