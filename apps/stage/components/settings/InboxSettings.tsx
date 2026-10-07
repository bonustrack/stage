import { useMemo } from 'react';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { capabilities } from '../../lib/capabilities';
import { channelTimestamp } from '../../lib/format';
import { useInbox, useMailboxes, useReadMail, type InboxState, type Mailbox } from '../../lib/mail';
import { usePalette } from '../../lib/theme';
import { Box, Col, Row, PAGE_GUTTER } from '../layout';
import { RetryNotice } from '../chrome/RetryNotice';
import { inboxRows, type InboxRow } from './Inbox.model';
import { SettingsGroup, SettingsPage } from './SettingsPage';
import { IconEmail1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconEmail1';

const ROW_PADDING = { paddingTop: 12, paddingBottom: 12, paddingLeft: 14, paddingRight: 14 };
const DOT = 8;

function mailRoute(label: string, id: string): string {
  return `/settings/mail?label=${encodeURIComponent(label)}&id=${encodeURIComponent(id)}`;
}

function InboxRowView({ row }: { row: InboxRow }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const { primary } = usePalette();
  return (
    <ListViewItem align="center" gap={12} dark={dark} padding={ROW_PADDING}
      onPress={() => { capabilities.navigate(mailRoute(row.label, row.id)); }}>
      <Box width={DOT} height={DOT} radius="full" background={row.unread ? primary : 'transparent'} />
      <Col flex={1} minWidth={0} gap={2}>
        <Row align="center" gap={8}>
          <Text value={row.sender} size="xs" weight={row.unread ? 'semibold' : undefined} color="link" truncate style={{ flex: 1 }} />
          <Caption value={channelTimestamp(row.ts)} color="secondary" />
        </Row>
        <Text value={row.subject} size="xs" color={row.unread ? 'link' : 'secondary'} truncate />
        {row.to === null ? null : <Caption value={row.to} color="secondary" />}
      </Col>
    </ListViewItem>
  );
}

function CenterNote({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Col align="center" justify="center" gap={8} padding={{ x: PAGE_GUTTER, y: 48 }}>
      {children}
    </Col>
  );
}

function Opening(): React.ReactElement {
  return (
    <CenterNote>
      <Spinner size={24} />
      <Text value="Opening your mailbox…" size="xs" color="secondary" textAlign="center" />
    </CenterNote>
  );
}

function EmptyMailbox({ boxes }: { boxes: readonly Mailbox[] }): React.ReactElement {
  const { sub } = usePalette();
  return (
    <CenterNote>
      <Glyph icon={IconEmail1} size={32} color={sub} />
      {boxes.map((box) => <Text key={box.mailAddress} value={box.mailAddress} size="xs" weight="semibold" color="link" textAlign="center" />)}
      <Text value="No mail yet" size="xs" color="secondary" textAlign="center" />
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
        <Caption value={`Could not open ${state.failed.join(', ')}. Try again later.`} color="danger"
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
    return <CenterNote><Text value="Claim a Stage name to get mail at name@st.box." size="xs" color="secondary" textAlign="center" /></CenterNote>;
  }
  if (inbox.isError) return <RetryNotice message="Could not open your mailbox. Check your connection and try again." onRetry={() => { void inbox.refetch(); }} />;
  if (inbox.data === undefined) return <Opening />;
  return <MailList boxes={boxes} state={inbox.data} />;
}

export function InboxSettings(): React.ReactElement {
  return (
    <SettingsPage title="Inbox">
      <InboxBody />
    </SettingsPage>
  );
}
