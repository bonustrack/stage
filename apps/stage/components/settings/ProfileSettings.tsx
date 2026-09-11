import { useCallback, useState } from 'react';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import type { PickedFile } from '@stage-labs/kit/react-native/file-picker';
import { BASENAME_CLAIM_URL, manageBasenameUrl } from '@stage-labs/client/identity/basenameWrite';
import { Box, Col, WEB_EDGE_CONTENT_WIDE, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { usePalette } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { flash } from '../../lib/toast';
import { getPeerName, getPeerProfileSource, usePeerProfiles } from '../../lib/peerProfiles';
import { setBasenameAvatar } from '../../lib/profileWrite';
import { shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { Avatar } from '../Avatar';
import { GroupImagePicker } from '../GroupImagePicker';
import { StackHeader } from '../chrome/StackHeader';
import { SettingsButtonRow, SettingsList, SettingsValueRow } from './rows';
import { profileView, type ProfileView } from './ProfileSettings.model';

function useAvatarChange(address: string | null, name: string | undefined): { busy: boolean; onPick: (file: PickedFile) => void } {
  const [busy, setBusy] = useState(false);
  const onPick = useCallback((file: PickedFile): void => {
    if (!address || !name || busy) return;
    setBusy(true);
    void (async (): Promise<void> => {
      try {
        await setBasenameAvatar(address, name, file);
        flash('Picture updated. It can take a minute to appear everywhere.');
      } catch (err) {
        flash(`Could not update the picture: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusy(false);
      }
    })();
  }, [address, name, busy]);
  return { busy, onPick };
}

function ProfileActions({ view, name, address, busy, onChangePicture }: {
  view: ProfileView; name: string | undefined; address: string; busy: boolean; onChangePicture: () => void;
}): React.ReactElement {
  return (
    <SettingsList>
      {view.canChangePicture ? (
        <SettingsButtonRow
          label={busy ? 'Updating picture…' : 'Change picture'}
          description="Uploads the image and writes it to your Basename on Base."
          onPress={onChangePicture}
        />
      ) : null}
      {view.manageLabel && name ? (
        <SettingsButtonRow label={view.manageLabel} onPress={() => { capabilities.openUrl(manageBasenameUrl(name)); }} />
      ) : null}
      {view.claimVisible ? (
        <SettingsButtonRow
          label="Claim a Basename"
          description="Opens base.org. Register with this wallet and pick “Set as primary name”."
          onPress={() => { capabilities.openUrl(BASENAME_CLAIM_URL); }}
        />
      ) : null}
      <SettingsValueRow
        label="Address"
        value={shortAddress(address)}
        onPress={() => { void capabilities.copyToClipboard(address); flash('Address copied'); }}
      />
    </SettingsList>
  );
}

export function ProfileSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const insets = useSafeAreaInsets();
  const address = useActiveAccountRecord()?.address ?? null;
  usePeerProfiles([address]);
  const name = getPeerName(address);
  const source = getPeerProfileSource(address);
  const view = profileView({ address, name, source });
  const [pickNonce, setPickNonce] = useState(0);
  const { busy, onPick } = useAvatarChange(address, name);

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Profile"/>
      <ScrollView style={WEB_STACK_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT_WIDE, WEB_STACK_CONTENT_PAD]}>
        <Col align="center" gap={12} padding={{ y: 24 }}>
          <Avatar address={address} size={96} />
          <Text value={view.title || (address ? shortAddress(address) : '')} size="2xl" weight="semibold" />
          {address ? <Caption value={shortAddress(address)} color="secondary" /> : null}
        </Col>
        <Caption color={fg} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {view.explanation}
        </Caption>
        {address ? (
          <Box>
            <ProfileActions
              view={view}
              name={name}
              address={address}
              busy={busy}
              onChangePicture={() => { if (!busy) setPickNonce(n => n + 1); }}
            />
          </Box>
        ) : null}
        <GroupImagePicker openNonce={pickNonce} onPick={onPick} />
      </ScrollView>
    </Col>
  );
}
