import { useState } from 'react';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Col, ScreenScroll } from '../layout';

import { capabilities } from '../../lib/capabilities';
import { getPeerHandle, getPeerName, getPeerProfileSource, invalidatePeerProfile, usePeerProfiles } from '../../lib/peerProfiles';
import { shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { Avatar } from '../Avatar';
import { StackHeader } from '../chrome/StackHeader';
import { SettingsList, SettingsValueRow } from './rows';
import { profileView, type ProfileView } from './ProfileSettings.model';
import { ClaimStageName } from './ProfileSettings.claim';
import { EditProfileSection } from './ProfileSettings.edit';

function ProfileActions({ address }: { address: string }): React.ReactElement {
  return (
    <SettingsList>
      <SettingsValueRow
        label="Address"
        value={shortAddress(address)}
        onPress={() => { void capabilities.copyToClipboard(address); capabilities.toast('Address copied'); }}
      />
    </SettingsList>
  );
}

function ProfileHeader({ address, name, handle, preview }: {
  address: string | null; name: string | undefined; handle: string | undefined; preview: string | null;
}): React.ReactElement {
  return (
    <Col align="center" gap={12} padding={{ y: 24 }}>
      <Avatar address={address} imageUri={preview} size={96} />
      <Text value={name ?? (address ? shortAddress(address) : '')} size="2xl" weight="semibold" />
      {handle && handle !== name ? <Caption value={handle} color="secondary" /> : null}
      {address ? <Caption value={shortAddress(address)} color="secondary" /> : null}
    </Col>
  );
}

function ProfileSections({ address, handle, view, onPreview }: {
  address: string; handle: string | undefined; view: ProfileView; onPreview: (uri: string | null) => void;
}): React.ReactElement {
  return (
    <>
      {view.claimVisible ? (
        <Box padding={{ bottom: 16 }}>
          <ClaimStageName address={address} onClaimed={() => { invalidatePeerProfile(address); }} />
        </Box>
      ) : null}
      {handle && view.canChangePicture ? (
        <Box padding={{ bottom: 16 }}>
          <EditProfileSection
            address={address}
            name={handle}
            onSaved={() => { invalidatePeerProfile(address); }}
            onImagePicked={onPreview}
          />
        </Box>
      ) : null}
      <Box>
        <ProfileActions address={address} />
      </Box>
    </>
  );
}

export function ProfileSettings(): React.ReactElement {

  const insets = useSafeAreaInsets();
  const address = useActiveAccountRecord()?.address ?? null;
  usePeerProfiles([address]);
  const name = getPeerName(address);
  const handle = getPeerHandle(address);
  const source = getPeerProfileSource(address);
  const view = profileView({ address, name: handle, source });
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Profile"/>
      <ScreenScroll contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <ProfileHeader address={address} name={name} handle={handle} preview={preview} />
        {view.explanation === '' ? null : (
          <Box padding={{ x: 16, bottom: 12 }}>
            <Text value={view.explanation} size="md" color="secondary" />
          </Box>
        )}
        {address ? <ProfileSections address={address} handle={handle} view={view} onPreview={setPreview} /> : null}
      </ScreenScroll>
    </Col>
  );
}
