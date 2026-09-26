
import { useQuery } from '@tanstack/react-query';

import { capabilities } from '../../lib/capabilities';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { VideoPlayer } from '@stage-labs/kit/react-native/video-player';
import { Spinner } from '../Spinner';
import { VoiceMessage } from '../VoiceMessage';
import { MessengerImageAttachment } from './ImageAttachment';
import { Box, Col, Row } from '../layout';
import { Card } from '@stage-labs/kit/react-native/card';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { usePalette } from '../../lib/theme';
import { fileCardModel } from './fileCard.model';
import { resolveRemoteAttachment } from '../../modules/messaging';
import { useLocalAttachment } from '../../lib/localAttachmentCache';
import type { Attachment } from './helpers';
import { IconFileBend } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFileBend';

function MessengerVideoAttachment({ uri }: { uri: string }): React.ReactElement {
  return (
    <Box margin={{ bottom: 6 }}>
      <Box width={220} radius="md" background="#000">
        <VideoPlayer src={uri} controls />
      </Box>
    </Box>
  );
}

export function AttachmentView({ att, fullUrl, fg }: {
  att: Attachment; fullUrl: string; fg: string;
}): React.ReactElement {
  if (att.kind === 'image') return <MessengerImageAttachment uri={fullUrl} />;
  if (att.kind === 'video' || att.mime?.startsWith('video/')) return <MessengerVideoAttachment uri={fullUrl} />;
  if (att.kind === 'audio' || att.mime?.startsWith('audio/')) {
    return <VoiceMessage uri={fullUrl} />;
  }
  const card = fileCardModel(att);
  return <AttachmentChip label={card.title} subtitle={card.subtitle} fg={fg} onPress={() => { capabilities.openUrl(fullUrl); }} />;
}

function AttachmentChip({ label, subtitle, fg, onPress }: {
  label: string; subtitle?: string; fg: string; onPress: () => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const { border } = usePalette();
  return (
    <Card dark={dark} background={border} padding={10} onPress={onPress} style={{ marginBottom: 6, maxWidth: 320 }}>
      <Row align="center" gap={10}>
        <Box width={40} height={40} radius="md" align="center" justify="center" surface="surface">
          <Glyph icon={IconFileBend} size={22} color={fg}/>
        </Box>
        <Col flex={1} minWidth={0} gap={2}>
          <Text weight="semibold" color={fg} numberOfLines={1}>{label}</Text>
          {subtitle ? <Text size="sm" role="secondary" numberOfLines={1}>{subtitle}</Text> : null}
        </Col>
      </Row>
    </Card>
  );
}

function fetchRemote(remote: Attachment['remote']): Promise<{ fileUri: string; mimeType?: string }> {
  if (!remote) throw new Error('attachment has no remote');
  return resolveRemoteAttachment(remote);
}

function AttachmentRetry({ label, fg, onRetry }: {
  label: string; fg: string; onRetry: () => void;
}): React.ReactElement {
  return <AttachmentChip label={`${label}. Tap to retry`} fg={fg} onPress={onRetry} />;
}

function AttachmentPending({ label, fg }: { label: string; fg: string }): React.ReactElement {
  return (
    <Row padding={{ x: 10, y: 8 }} margin={{ bottom: 6 }} align="center" gap={8} radius="sm" background="rgba(0,0,0,0.12)">
      <Spinner size={20} color={fg}/>
      <Text size="xs" role="secondary" numberOfLines={1}>
        {label}
      </Text>
    </Row>
  );
}

function useRemoteAttachment(remote: Attachment['remote']): {
  uri: string | null; mime: string | undefined; isError: boolean; retry: () => void;
} {
  const { data, isError, refetch } = useQuery({
    queryKey: ['remoteAttachment', remote?.url ?? ''],
    queryFn: () => fetchRemote(remote),
    enabled: !!remote,
    staleTime: Infinity,
    retry: false,
  });
  return {
    uri: data?.fileUri ?? null,
    mime: data?.mimeType,
    isError,
    retry: () => { void refetch(); },
  };
}

export function RemoteAttachmentResolver({ att, fg, msgId, index }: {
  att: Attachment; fg: string;
  msgId?: string; index?: number;
}): React.ReactElement {
  const local = useLocalAttachment(msgId, index);
  const remote = useRemoteAttachment(att.remote);
  const uri = local ?? remote.uri;
  const label = att.name ?? 'attachment';

  if (remote.isError && !local) {
    return <AttachmentRetry label={label} fg={fg} onRetry={remote.retry} />;
  }
  if (!uri) return <AttachmentPending label={label} fg={fg} />;
  return <AttachmentView att={{ ...att, mime: remote.mime ?? att.mime }} fullUrl={uri} fg={fg} />;
}
