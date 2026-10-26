import { useMemo } from 'react';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { capabilities } from '../../lib/capabilities';
import { channelTimestamp } from '../../lib/format';
import { useInbox, useMailboxes, useReadMail, type InboxState, type Mailbox } from '../../lib/mail';
import { usePalette } from '../../lib/theme';
import { useWebTabRail } from '../../lib/webLayout';
import { RetryNotice } from '../chrome/RetryNotice';
import { inboxRows, type InboxRow } from './Inbox.model';
import { SettingsGroup, SettingsPage } from './SettingsPage';
import { INBOX_ROUTE } from '../tabs/menuPages';
import { IconEmail1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconEmail1';
import { Text } from '@stage-labs/kit/react-native/text';
import { Column, Row, PAGE_GUTTER } from '../layout';

const ROW_PADDING = { paddingTop: 12, paddingBottom: 12, paddingLeft: 14, paddingRight: 14 };
const DOT = 8;

function mailRoute(label: string, id: string): string {
  return `${INBOX_ROUTE}/mail?label=${encodeURIComponent(label)}&id=${encodeURIComponent(id)}`;
}

function InboxRowView({ row }: { row: InboxRow }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const { primary } = usePalette();
  return (
    <ListViewItem align="center" gap={12} dark={dark} padding={ROW_PADDING}
      onPress={() => { capabilities.navigate(mailRoute(row.label, row.id)); }}>
      <Column width={DOT} height={DOT} radius="full" background={row.unread ? primary : 'transparent'} />
      <Column weight={1} minWidth={0} gap={2}>
        <Row align="center" gap={8}>
          <Text text={row.sender} size="xs" fontWeight={row.unread ? 'semibold' : undefined} color="link" truncate style={{ flex: 1 }} />
          <Text size="md" variant="caption" text={channelTimestamp(row.ts)} color="secondary" />
        </Row>
        <Text text={row.subject} size="xs" color={row.unread ? 'link' : 'secondary'} truncate />
        {row.to === null ? null : <Text size="md" variant="caption" text={row.to} color="secondary" />}
      </Column>
    </ListViewItem>
  );
}

function CenterNote({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Column align="center" justify="center" gap={8} padding={{ x: PAGE_GUTTER, y: 48 }}>
      {children}
    </Column>
  );
}

function Opening(): React.ReactElement {
  return (
    <CenterNote>
      <Spinner size={24} />
      <Text text="Opening your mailbox…" size="xs" color="secondary" textAlign="center" />
    </CenterNote>
  );
}

function EmptyMailbox({ boxes }: { boxes: readonly Mailbox[] }): React.ReactElement {
  const { sub } = usePalette();
  return (
    <CenterNote>
      <Glyph icon={IconEmail1} size={32} color={sub} />
      {boxes.map((box) => <Text key={box.mailAddress} text={box.mailAddress} size="xs" fontWeight="semibold" color="link" textAlign="center" />)}
      <Text text="No mail yet" size="xs" color="secondary" textAlign="center" />
    </CenterNote>
  );
}

function footnoteFor(boxes: readonly Mailbox[]): string {
  return `Mail to ${boxes.map((box) => box.mailAddress).join(', ')} is decrypted on this device. Read marks stay on this device.`;
}

function MailList({ boxes, state }: { boxes: readonly Mailbox[]; state: InboxState }): React.ReactElement {
  const read = useReadMail();
  const rows = useMemo(() => inboxRows(state.entries, read, boxes.length), [state.entries, read, boxes.length]);
  if (rows.length === 0 && state.failed.length === 0) return <EmptyMailbox boxes={boxes} />;
  return (
    <>
      {state.failed.length === 0 ? null : (
        <Text size="md" variant="caption" text={`Could not open ${state.failed.join(', ')}. Try again later.`} color="danger"
          style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 16 }} />
      )}
      <SettingsGroup footnote={footnoteFor(boxes)}>
        {rows.map((row) => <InboxRowView key={row.key} row={row} />)}
      </SettingsGroup>
    </>
  );
}

function InboxBody(): React.ReactElement {
  const mailboxes = useMailboxes();
  const inbox = useInbox(mailboxes.data);
  const boxes = mailboxes.data;
  if (mailboxes.isError) return <RetryNotice message="Could not look up your Stage names." onRetry={() => { void mailboxes.refetch(); }} />;
  if (boxes === undefined) return <Opening />;
  if (boxes.length === 0) {
    return <CenterNote><Text text="Claim a Stage name to get mail at name@st.box." size="xs" color="secondary" textAlign="center" /></CenterNote>;
  }
  if (inbox.isError) return <RetryNotice message="Could not open your mailbox. Check your connection and try again." onRetry={() => { void inbox.refetch(); }} />;
  if (inbox.data === undefined) return <Opening />;
  return <MailList boxes={boxes} state={inbox.data} />;
}

export function InboxSettings(): React.ReactElement {
  const rail = useWebTabRail();
  return (
    <SettingsPage title="Inbox" back={!rail}>
      <InboxBody />
    </SettingsPage>
  );
}
