import { useEffect, useState } from 'react';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box, Col, PAGE_GUTTER } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';

import { capabilities } from '../../lib/capabilities';
import { getPeerHandle, getPeerName, getPeerProfileSource, invalidatePeerProfile, usePeerProfiles } from '../../lib/peerProfiles';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { Avatar } from '../Avatar';
import { SettingsPage } from './SettingsPage';
import { profileView, type ProfileView } from './ProfileSettings.model';
import { ClaimStageName } from './ProfileSettings.claim';
import { EditProfileModal } from './EditProfileModal';
import { Button } from '@stage-labs/kit/react-native/button';

const COPIED_MS = 1500;

function CopyableAddress({ address }: { address: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => { setCopied(false); }, COPIED_MS);
    return () => { clearTimeout(timer); };
  }, [copied]);
  const copy = (): void => {
    capabilities.copy('Address', address);
    setCopied(true);
  };
  return (
    <Pressable onPress={copy} hitSlop={8}>
      <Text value={copied ? 'Copied' : shortAddress(address)} size="md" color="secondary" />
    </Pressable>
  );
}

function ProfileHeader({ address, name, handle, children }: {
  address: string | null; name: string | undefined; handle: string | undefined; children: React.ReactNode;
}): React.ReactElement {
  return (
    <Col align="center" gap={12} padding={{ y: 24 }}>
      {children}
      <Text value={name ?? (address ? shortAddress(address) : '')} size="2xl" weight="semibold" />
      {handle && displayHandle(handle) !== name ? <Caption value={displayHandle(handle)} color="secondary" /> : null}
      {address ? <CopyableAddress address={address} /> : null}
    </Col>
  );
}

function ClaimPane({ address }: { address: string }): React.ReactElement {
  return (
    <Col align="center" padding={{ top: 24, bottom: 16 }}>
      <ClaimStageName address={address} onClaimed={() => { invalidatePeerProfile(address); }} />
    </Col>
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
        <Box padding={{ x: PAGE_GUTTER, bottom: 12 }}>
          <Text value={view.explanation} size="md" color="secondary" />
        </Box>
      )}
      {editable ? (
        <Box padding={{ x: PAGE_GUTTER, bottom: 16 }}>
          <Button label="Edit profile" block size="lg" color="secondary" variant="solid" dark={dark} onPress={() => { setEditing(true); }} />
          <EditProfileModal visible={editing} onClose={() => { setEditing(false); }} address={address} handle={handle} />
        </Box>
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
      {address && view.claimVisible ? <ClaimPane address={address} /> : (
        <EditPane address={address} handle={handle} view={view} />
      )}
    </SettingsPage>
  );
}
