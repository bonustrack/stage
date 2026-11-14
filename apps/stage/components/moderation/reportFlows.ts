import { Alert, type AlertButton } from 'react-native';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';
import { blockPerson, sendReport, unblockPerson } from '../../lib/moderation';
import { blockRequestConv } from '../../lib/xmtp.conv';
import { REPORT_COPY, messageReportText, personReportText, type ReportedMessage, type ReportedPerson } from './report.model';

async function deliver(text: string, block: (() => Promise<void>) | null): Promise<void> {
  try {
    const delivery = await sendReport(text);
    if (block !== null) await block();
    capabilities.toast(delivery === 'sent' ? REPORT_COPY.sent : REPORT_COPY.queued);
  } catch (err) {
    report('moderation.report', err);
    capabilities.toast(REPORT_COPY.failed);
  }
}

const CANCEL: AlertButton = { text: 'Cancel', style: 'cancel' };

export function confirmReportMessage(message: ReportedMessage, onBlocked: () => void): void {
  const text = messageReportText(message);
  const buttons: AlertButton[] = [
    CANCEL,
    {
      text: REPORT_COPY.report,
      onPress: () => {
        void deliver(text, null);
      },
    },
  ];
  if (!message.group) {
    buttons.push({
      text: REPORT_COPY.reportAndBlock,
      style: 'destructive',
      onPress: () => {
        void deliver(text, async () => {
          await blockRequestConv(message.convId);
          onBlocked();
        });
      },
    });
  }
  Alert.alert(REPORT_COPY.messageTitle, message.group ? REPORT_COPY.messageBodyInChannel : REPORT_COPY.messageBody, buttons);
}

export function confirmReportPerson(person: ReportedPerson, onBlocked: () => void): void {
  const text = personReportText(person);
  Alert.alert(REPORT_COPY.personTitle, REPORT_COPY.personBody, [
    CANCEL,
    {
      text: REPORT_COPY.report,
      onPress: () => {
        void deliver(text, null);
      },
    },
    {
      text: REPORT_COPY.reportAndBlock,
      style: 'destructive',
      onPress: () => {
        void deliver(text, async () => {
          await blockPerson(person.address);
          onBlocked();
        });
      },
    },
  ]);
}

async function changeBlock(change: () => Promise<void>, done: string, onChanged: () => void): Promise<void> {
  try {
    await change();
    onChanged();
    capabilities.toast(done);
  } catch (err) {
    report('moderation.block', err);
    capabilities.toast(REPORT_COPY.blockFailed);
  }
}

export function confirmBlockPerson(address: string, onChanged: () => void): void {
  Alert.alert(REPORT_COPY.blockTitle, REPORT_COPY.blockBody, [
    CANCEL,
    {
      text: REPORT_COPY.block,
      style: 'destructive',
      onPress: () => {
        void changeBlock(() => blockPerson(address), REPORT_COPY.blocked, onChanged);
      },
    },
  ]);
}

export function unblockPersonNow(address: string, onChanged: () => void): void {
  void changeBlock(() => unblockPerson(address), REPORT_COPY.unblocked, onChanged);
}
