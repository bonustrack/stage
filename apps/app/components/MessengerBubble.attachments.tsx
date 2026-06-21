
import { useEffect, useState } from 'react';

import { Linking } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Spinner } from './Spinner';
import { VoiceMessage } from './VoiceMessage';
import { MessengerImageAttachment } from './MessengerImageAttachment';
import { MessengerVideoAttachment } from './MessengerVideoAttachment';
import { Row } from './layout';
import { resolveRemoteAttachment } from '../modules/messaging';
import { useLocalAttachment } from '../lib/localAttachmentCache';
import type { Attachment } from './MessengerBubble.helpers';

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

export function RemoteAttachmentResolver({ att, fg, sub, dark, msgId, index }: {
  att: Attachment; fg: string; sub: string; dark: boolean;
  msgId?: string; index?: number;
}): React.ReactElement {
  const local = useLocalAttachment(msgId, index);
  const [remoteUri, setRemoteUri] = useState<string | null>(null);
  const [mime, setMime] = useState<string | undefined>(att.mime);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const uri = local ?? remoteUri;
  useEffect(() => {
    if (!att.remote) return;
    let cancelled = false;
    setFailed(false);
    void resolveRemoteAttachment(att.remote)
      .then(r => { if (!cancelled) { setRemoteUri(r.fileUri); if (r.mimeType) setMime(r.mimeType); } })
      .catch(() => {
        if (!cancelled && !local) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [att.remote, attempt, local]);

  if (failed) {
    return (
      <Pressable
        onPress={() => { setAttempt(a => a + 1); }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
          backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 6,
        }}
>
        <Icon name="paperClip" size={16} color={fg}/>
        <Text size="xs" color={fg} style={{ flexShrink: 1 }} numberOfLines={1}>
          {att.name ?? 'attachment'} — tap to retry
        </Text>
      </Pressable>
    );
  }
  if (!uri) {
    return (
      <Row padding={{ x: 10, y: 8 }} margin={{ bottom: 6 }} align="center" gap={8} radius="sm" background="rgba(0,0,0,0.12)">
        <Spinner size={20} color={fg}/>
        <Text size="xs" color={sub} numberOfLines={1}>
          {att.name ?? 'attachment'}
        </Text>
      </Row>
    );
  }
  return <AttachmentView att={{ ...att, mime }} fullUrl={uri} fg={fg} dark={dark} />;
}
