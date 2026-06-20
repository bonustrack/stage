/** @file MessengerBubble attachment renderers (image/video/audio/file) plus the lazy remote IPFS-ciphertext resolver, extracted to keep the bubble file under the lint cap. */

import { useEffect, useState } from 'react';

import { Linking } from 'react-native';
import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Spinner } from './Spinner';
import { VoiceMessage } from './VoiceMessage';
import { MessengerImageAttachment } from './MessengerImageAttachment';
import { MessengerVideoAttachment } from './MessengerVideoAttachment';
import { Row } from './layout';
import { resolveRemoteAttachment } from '../modules/messaging';
import { useLocalAttachment } from '../lib/localAttachmentCache';
import type { Attachment } from './MessengerBubble.helpers';

/** Renders a single message attachment (image, video, audio, or file) by its type. */
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

/** Remote (multi-remote) attachment: download+decrypt the IPFS ciphertext on mount to a local `file://` URI then hand to AttachmentView, showing a spinner while resolving and a tappable retry chip on failure. */
export function RemoteAttachmentResolver({ att, fg, sub, dark, msgId, index }: {
  att: Attachment; fg: string; sub: string; dark: boolean;
  /** Message id + attachment index that look up a LOCAL `file://` URI the composer cached when this user just sent it, painting the on-disk copy instantly while the remote ciphertext downloads+decrypts in the background. */
  msgId?: string; index?: number;
}): React.ReactElement {
  /** REACTIVE cached local URI (sender side): the echo bubble often mounts before send resolves rememberLocalAttachments, so subscribing to the cache repaints the on-disk file the moment the local URI lands instead of sitting on a spinner. */
  const local = useLocalAttachment(msgId, index);
  /** Decrypted remote URI, set once the IPFS round trip completes. */
  const [remoteUri, setRemoteUri] = useState<string | null>(null);
  const [mime, setMime] = useState<string | undefined>(att.mime);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** Prefer the local on-disk copy (same bytes, no download) whenever we have it; fall back to the decrypted remote copy (recipient side / sender after a restart when the session cache is gone). */
  const uri = local ?? remoteUri;
  useEffect(() => {
    if (!att.remote) return;
    let cancelled = false;
    setFailed(false);
    void resolveRemoteAttachment(att.remote)
      .then(r => { if (!cancelled) { setRemoteUri(r.fileUri); if (r.mimeType) setMime(r.mimeType); } })
      .catch(() => {
        /** A local copy is (or may still become) on screen — a failed remote resolve is harmless for the sender, so don't flip to the retry chip and blank it out. Only surface failure with nothing to show. */
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
