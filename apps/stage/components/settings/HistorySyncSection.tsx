import { useState } from 'react';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Box, PAGE_GUTTER } from '../layout';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { historySyncProblem, runHistorySync, useHistorySyncPhase } from '../../lib/historySync';
import { receiveHistoryWithCode } from '../../lib/historyTransfer';
import { historySyncIsActive, historySyncPhaseLabel } from '../../lib/historySync.model';
import { ReceiveCodeSheet, SendHistorySheet } from './HistoryTransferSheets';
import { SettingsButtonRow, SettingsList } from './rows';
import { IconArrowInbox } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowInbox';
import { IconArrowOutOfBox } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowOutOfBox';
import { IconArrowRotateClockwise } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRotateClockwise';

const SYNC_DESC = 'Ask your other devices for the messages this device is missing. Keep Stage open on the other device while it answers.';
const SEND_DESC = 'Package this device\'s history for another device. You will get a code to enter there.';
const RECEIVE_DESC = 'Enter the code shown on the device that sent its history.';

async function receiveFromSettings(code: string): Promise<void> {
  await receiveHistoryWithCode(code);
  capabilities.toast('History imported');
}

export function HistorySyncSection(): React.ReactElement {
  const { text: fg } = usePalette();
  const phase = useHistorySyncPhase();
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const syncing = historySyncIsActive(phase);
  const status = historySyncPhaseLabel(phase, historySyncProblem());
  return (
    <>
      <Caption color={fg} style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 28, paddingBottom: 8 }}>
        HISTORY
      </Caption>
      <Box>
        <SettingsList>
          <SettingsButtonRow
            label={syncing ? 'Syncing history…' : 'Sync history from another device'}
            description={status ?? SYNC_DESC}
            iconStart={IconArrowRotateClockwise}
            onPress={() => { if (!syncing) void runHistorySync(); }}
          />
          <SettingsButtonRow
            label="Send history to another device"
            description={SEND_DESC}
            iconStart={IconArrowOutOfBox}
            onPress={() => { setSendOpen(true); }}
          />
          <SettingsButtonRow
            label="Receive history with a code"
            description={RECEIVE_DESC}
            iconStart={IconArrowInbox}
            onPress={() => { setReceiveOpen(true); }}
          />
        </SettingsList>
      </Box>
      <SendHistorySheet visible={sendOpen} onClose={() => { setSendOpen(false); }} />
      <ReceiveCodeSheet visible={receiveOpen} onClose={() => { setReceiveOpen(false); }} onReceive={receiveFromSettings} />
    </>
  );
}
