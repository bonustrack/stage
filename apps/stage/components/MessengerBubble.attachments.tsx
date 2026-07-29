
import { useQuery } from '@tanstack/react-query';

import { Linking } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { VideoPlayer } from '@stage-labs/kit/react-native/video-player';
import { Spinner } from './Spinner';
import { VoiceMessage } from './VoiceMessage';
import { MessengerImageAttachment } from './MessengerImageAttachment';
import { Box, Row } from './layout';
import { resolveRemoteAttachment } from '../modules/messaging';
import { useLocalAttachment } from '../lib/localAttachmentCache';
import type { Attachment } from './MessengerBubble.helpers';

function MessengerVideoAttachment({ uri }: { uri: string }): React.ReactElement {
  return (
    <Box margin={{ bottom: 6 }}>
      <Box width={220} radius="md" background="#000">
        <VideoPlayer src={uri} controls />
      </Box>
    </Box>
  );
}

export function AttachmentView({ att, fullUrl, fg, dark }: {
  att: Attachment; fullUrl: string; fg: string; dark: boolean;
}): React.ReactElement {
  if (att.kind === 'image') return <MessengerImageAttachment uri={fullUrl} dark={dark} />;
  if (att.kind === 'video' || att.mime?.startsWith('video/')) return <MessengerVideoAttachment uri={fullUrl} />;
  if (att.kind === 'audio' || att.mime?.startsWith('audio/')) {
    return <VoiceMessage uri={fullUrl} />;
  }
  const label = att.name ?? `${att.kind} attachment`;
  return (
    <Pressable
      onPress={() => void Linking.openURL(fullUrl)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 6,
      }}
>
      <Icon name="paperClip" size={16} color={fg}/>
      <Text size="xs" color={fg} style={{ flexShrink: 1 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function fetchRemote(remote: Attachment['remote']): Promise<{ fileUri: string; mimeType?: string }> {
  if (!remote) throw new Error('attachment has no remote');
  return resolveRemoteAttachment(remote);
}

function AttachmentRetry({ label, fg, onRetry }: {
  label: string; fg: string; onRetry: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onRetry}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 6,
      }}
>
      <Icon name="paperClip" size={16} color={fg}/>
      <Text size="xs" color={fg} style={{ flexShrink: 1 }} numberOfLines={1}>
        {label} — tap to retry
      </Text>
    </Pressable>
  );
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

export function RemoteAttachmentResolver({ att, fg, dark, msgId, index }: {
  att: Attachment; fg: string; dark: boolean;
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
  return <AttachmentView att={{ ...att, mime: remote.mime ?? att.mime }} fullUrl={uri} fg={fg} dark={dark} />;
}
