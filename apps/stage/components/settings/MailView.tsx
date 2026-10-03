import { useEffect, useMemo, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Text } from '@stage-labs/kit/react-native/text';
import type { ParsedMail } from '@stage-labs/client/mail/mime';
import { capabilities } from '../../lib/capabilities';
import { downloadFile } from '../../lib/fileDownload';
import { reported } from '../../lib/errorPolicy';
import { markMailRead, useMail, useMailboxes } from '../../lib/mail';
import { useEffectiveColorScheme } from '../../lib/theme';
import { Box, Col, Row, PAGE_GUTTER } from '../layout';
import { RetryNotice } from '../chrome/RetryNotice';
import {
  mailBody, mailDataUri, mailDateLabel, mailReceivedAt, safeFileName, subjectLabel, visibleBlocks, type MailAttachmentRow,
} from './Inbox.model';
import { MailBlocks } from './MailBlocks';
import { SettingsGroup, SettingsNavRow, SettingsPage } from './SettingsPage';
import { settingsSection } from './settingsCatalog.model';
import { IconFileBend } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFileBend';
import { IconFileDownload } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFileDownload';

const META_LABEL_WIDTH = 48;

function MetaLine({ label, value }: { label: string; value: string }): React.ReactElement | null {
  if (value === '') return null;
  return (
    <Row gap={8} align="start">
      <Text value={label} size="2xs" color="secondary" style={{ width: META_LABEL_WIDTH }} />
      <Text value={value} size="2xs" color="link" selectable style={{ flex: 1 }} />
    </Row>
  );
}

function ImagesNotice({ shown, onToggle }: { shown: boolean; onToggle: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Box padding={12} radius="sm" surface="raised">
      <Row align="center" gap={12}>
        <Text value={shown ? 'Images from the sender are shown.' : 'Images from the sender are hidden.'}
          size="2xs" color="secondary" style={{ flex: 1 }} />
        <Button label={shown ? 'Hide images' : 'Show images'} size="sm" color="secondary" variant="solid" dark={dark} onPress={onToggle} />
      </Row>
    </Box>
  );
}

function saveAttachment(row: MailAttachmentRow): void {
  const { attachment } = row;
  void downloadFile(mailDataUri(attachment), safeFileName(attachment.filename), attachment.mimeType).catch((err: unknown) => {
    reported('mail.download')(err);
    capabilities.toast('Could not save this file.');
  });
}

function Attachments({ rows }: { rows: readonly MailAttachmentRow[] }): React.ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <SettingsGroup title="Attachments">
      {rows.map((row) => (
        <SettingsNavRow key={row.key} label={row.title} value={row.subtitle} iconStart={IconFileBend} iconEnd={IconFileDownload}
          onPress={() => { saveAttachment(row); }} />
      ))}
    </SettingsGroup>
  );
}

function MailContent({ mail, id }: { mail: ParsedMail; id: string }): React.ReactElement {
  const body = useMemo(() => mailBody(mail), [mail]);
  const [showImages, setShowImages] = useState(false);
  const blocks = useMemo(() => visibleBlocks(body.blocks, showImages), [body.blocks, showImages]);
  const received = mailReceivedAt(id);
  return (
    <>
      <Col gap={16} padding={{ x: PAGE_GUTTER, top: 20 }}>
        <Text value={subjectLabel(mail.subject)} size="xl" weight="semibold" color="link" selectable />
        <Col gap={4}>
          <MetaLine label="From" value={mail.from} />
          <MetaLine label="To" value={mail.to} />
          <MetaLine label="Cc" value={mail.cc} />
          <MetaLine label="Date" value={received === null ? mail.date : mailDateLabel(received)} />
        </Col>
        {body.remoteImages ? <ImagesNotice shown={showImages} onToggle={() => { setShowImages(!showImages); }} /> : null}
        <MailBlocks blocks={blocks} />
      </Col>
      <Attachments rows={body.attachments} />
    </>
  );
}

function MailBodyState({ label, id }: { label: string; id: string }): React.ReactElement {
  const mailboxes = useMailboxes();
  const box = mailboxes.data?.find((candidate) => candidate.label === label);
  const mail = useMail(box, id);
  const opened = mail.data !== undefined;
  useEffect(() => { if (opened) markMailRead(label, id); }, [opened, label, id]);
  if (mailboxes.data !== undefined && box === undefined) {
    return <RetryNotice message="This mail is not in your mailboxes." onRetry={() => { void mailboxes.refetch(); }} />;
  }
  if (mail.isError) return <RetryNotice message="Could not decrypt this mail. Check your connection and try again." onRetry={() => { void mail.refetch(); }} />;
  if (mail.data === undefined) {
    return (
      <Col align="center" gap={8} padding={{ x: PAGE_GUTTER, y: 48 }}>
        <Spinner size={24} />
        <Text value="Decrypting…" size="2xs" color="secondary" />
      </Col>
    );
  }
  return <MailContent mail={mail.data} id={id} />;
}

export function MailView({ label, id }: { label: string; id: string }): React.ReactElement {
  return (
    <SettingsPage title="Mail" backTo={settingsSection('inbox').href}>
      <MailBodyState label={label} id={id} />
    </SettingsPage>
  );
}
