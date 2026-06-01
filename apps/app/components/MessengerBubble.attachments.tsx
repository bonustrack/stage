/** Attachment renderers for MessengerBubble — image/video/audio/file plus the
 *  lazy remote (IPFS ciphertext) resolver. Extracted to keep the bubble file
 *  under the phase-2 lint cap. */

import { useEffect, useState } from 'react';
import { Linking, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Spinner } from './Spinner';
import { MessengerAudioPlayer } from './MessengerAudioPlayer';
import { MessengerImageAttachment } from './MessengerImageAttachment';
import { MessengerVideoAttachment } from './MessengerVideoAttachment';
import { Row } from './layout';
import { resolveRemoteAttachment } from '../lib/xmtp';
import type { Attachment } from './MessengerBubble.helpers';

export function AttachmentView({ att, fullUrl, fg, sub, dark }: {
  att: Attachment; fullUrl: string; fg: string; sub: string; dark: boolean;
}): React.ReactElement {
  if (att.kind === 'image') return <MessengerImageAttachment uri={fullUrl} dark={dark} />;
  if (att.kind === 'video' || att.mime?.startsWith('video/')) return <MessengerVideoAttachment uri={fullUrl} />;
  if (att.kind === 'audio') {
    return <MessengerAudioPlayer uri={fullUrl} fg={fg} sub={sub} />;
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
      <Icon name="paperClip" size={16} color={fg} />
      <Text style={{ color: fg, fontSize: 13, flexShrink: 1 , fontFamily: 'Calibre-Medium'}} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Remote (multi-remote) attachment: ciphertext lives on IPFS. Download +
 *  decrypt on mount to a local `file://` URI, then hand off to the regular
 *  `AttachmentView`. Shows a spinner while resolving and a tappable retry chip
 *  on failure (gateway hiccup / decrypt error). */
export function RemoteAttachmentResolver({ att, fg, sub, dark }: {
  att: Attachment; fg: string; sub: string; dark: boolean;
}): React.ReactElement {
  const [uri, setUri] = useState<string | null>(null);
  const [mime, setMime] = useState<string | undefined>(att.mime);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!att.remote) return;
    let cancelled = false;
    setFailed(false);
    void resolveRemoteAttachment(att.remote)
      .then(r => { if (!cancelled) { setUri(r.fileUri); if (r.mimeType) setMime(r.mimeType); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [att.remote, attempt]);

  if (failed) {
    return (
      <Pressable
        onPress={() => setAttempt(a => a + 1)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
          backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 6,
        }}
      >
        <Icon name="paperClip" size={16} color={fg} />
        <Text style={{ color: fg, fontSize: 13, flexShrink: 1, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
          {att.name ?? 'attachment'} — tap to retry
        </Text>
      </Pressable>
    );
  }
  if (!uri) {
    return (
      <Row align="center" gap={8} px={10} py={8} radius={8} bg="rgba(0,0,0,0.12)" mb={6}>
        <Spinner size={20} color={fg} />
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
          {att.name ?? 'attachment'}
        </Text>
      </Row>
    );
  }
  return <AttachmentView att={{ ...att, mime }} fullUrl={uri} fg={fg} sub={sub} dark={dark} />;
}
