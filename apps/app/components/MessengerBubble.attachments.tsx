/** Attachment renderers for MessengerBubble — image/video/audio/file plus the
 *  lazy remote (IPFS ciphertext) resolver. Extracted to keep the bubble file
 *  under the phase-2 lint cap. */

import { useEffect, useState } from 'react';
import { Linking, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Spinner } from './Spinner';
import { VoiceMessage } from './VoiceMessage';
import { MessengerImageAttachment } from './MessengerImageAttachment';
import { MessengerVideoAttachment } from './MessengerVideoAttachment';
import { Row } from './layout';
import { resolveRemoteAttachment } from '../lib/xmtp';
import { getLocalAttachment } from '../lib/localAttachmentCache';
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
      <Icon name="paperClip" size={16} color={fg} />
      <Text style={{ color: fg, fontSize: 13, flexShrink: 1 , fontFamily: 'Calibre-Medium'}} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Remote (multi-remote) attachment: ciphertext lives on IPFS. Download +
 *  decrypt on mount to a local `file://` URI, then hand off to the regular
 *  `AttachmentView`. Shows a spinner while resolving and a tappable retry chip
 *  on failure (gateway hiccup / decrypt error). */
export function RemoteAttachmentResolver({ att, fg, sub, dark, msgId, index }: {
  att: Attachment; fg: string; sub: string; dark: boolean;
  /** Message id + attachment index used to look up a LOCAL `file://` URI cached
   *  by the composer when this user just sent the attachment. Lets us paint the
   *  already-on-disk local copy instantly (no blank/spinner) while the remote
   *  ciphertext downloads + decrypts in the background. */
  msgId?: string; index?: number;
}): React.ReactElement {
  /** Seed with the cached local URI (sender side) so there's zero gap between the
   *  optimistic bubble and the confirmed one — the remote resolve below swaps it
   *  for the decrypted copy once ready (same bytes, so no visible change). */
  const local = msgId !== undefined && index !== undefined
    ? getLocalAttachment(msgId, index) : undefined;
  const [uri, setUri] = useState<string | null>(local ?? null);
  const [mime, setMime] = useState<string | undefined>(att.mime);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!att.remote) return;
    let cancelled = false;
    setFailed(false);
    void resolveRemoteAttachment(att.remote)
      .then(r => { if (!cancelled) { setUri(r.fileUri); if (r.mimeType) setMime(r.mimeType); } })
      .catch(() => {
        /** A local copy is already on screen — a failed remote resolve is harmless
         *  (the recipient-less sender already sees the image), so don't flip to the
         *  retry chip and blank it out. Only surface failure with nothing to show. */
        if (!cancelled && !local) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [att.remote, attempt, local]);

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
  return <AttachmentView att={{ ...att, mime }} fullUrl={uri} fg={fg} dark={dark} />;
}
