
import { useQuery } from '@tanstack/react-query';

import { Alert } from 'react-native';
import { Box } from '../layout';
import {
  getOrCreateXmtpClient, resetActiveXmtpStore, selfEthAddress, shortAddress, useActiveAccount,
} from '../../modules/messaging';
import { reloadApp } from '../../lib/reloadApp';
import { capabilities } from '../../lib/capabilities';
import { MessengerSessions } from './MessengerSessions';
import { HistorySyncSection } from './HistorySyncSection';
import { SettingsPage, SettingsSectionLabel } from './SettingsPage';
import { SettingsButtonRow, SettingsList, SettingsValueRow } from './rows';

function onResetIdentity(): void {
  Alert.alert(
    'Reset XMTP database',
    'Wipes the local XMTP database of the current account only. The account and its keys stay. Messages stored on this device for this account are gone; a fresh installation is created on next launch.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => {
          void (async (): Promise<void> => {
            await resetActiveXmtpStore();
            reloadApp();
          })();
        } },
    ],
  );
}

interface XmtpIdentity { addr: string; inbox: string; install: string }

const NO_IDENTITY: XmtpIdentity = { addr: '', inbox: '', install: '' };

async function fetchXmtpIdentity(): Promise<XmtpIdentity> {
  const client = await getOrCreateXmtpClient('production');
  const address = await selfEthAddress();
  return {
    addr: address ?? '',
    inbox: client.inboxId,
    install: client.installationId ?? '',
  };
}

export function MessengerSettings(): React.ReactElement {
  const epoch = useActiveAccount();
  const { data: id = NO_IDENTITY } = useQuery({
    queryKey: ['xmtpIdentity', epoch],
    queryFn: fetchXmtpIdentity,
    staleTime: Infinity,
  });
  const { addr, inbox, install } = id;

  const hasRows = addr !== '' || inbox !== '' || install !== '';

  return (
    <SettingsPage title="Messenger">
      <SettingsSectionLabel top={20}>XMTP ACCOUNT</SettingsSectionLabel>
      {hasRows ? (
        <Box>
          <SettingsList>
            {addr ? (
              <SettingsValueRow
                label="Your XMTP address"
                value={shortAddress(addr)}
                onPress={() => { capabilities.copy('Your XMTP address', addr); }}
              />
            ) : null}
            {inbox ? (
              <SettingsValueRow
                label="Inbox id"
                value={inbox}
                onPress={() => { capabilities.copy('Inbox id', inbox); }}
              />
            ) : null}
            {install ? (
              <SettingsValueRow
                label="Installation id"
                value={shortAddress(install)}
                onPress={() => { capabilities.copy('Installation id', install); }}
              />
            ) : null}
          </SettingsList>
        </Box>
      ) : null}

      <MessengerSessions />

      <HistorySyncSection />

      <Box padding={{ top: 28 }}>
        <SettingsList>
          <SettingsButtonRow
            label="Reset XMTP database"
            danger
            onPress={onResetIdentity}
          />
        </SettingsList>
      </Box>
    </SettingsPage>
  );
}
