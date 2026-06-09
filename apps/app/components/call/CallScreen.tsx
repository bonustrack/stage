/** CallScreen — the full-screen in-call surface for a 1:1 P2P call.
 *
 *  Layout: remote video fills the screen; the local self-preview is a small
 *  inset card; a bottom control bar carries mute / camera / screenshare /
 *  hangup. Voice-only calls show an avatar placeholder instead of remote video.
 *  Renders inside a RN <Modal> so it overlays the conversation.
 *
 *  Built from Kit primitives (Box/Row, Button pill icon buttons, Text) + the
 *  shared palette — no raw size/color/spacing literals beyond layout geometry.
 *  RTCView is reached through the lazy webrtc guard so this file never imports
 *  the native module at module scope. */

import { Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { Box, Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { getWebRTC } from '../../lib/webrtc';
import type { CallState } from '../../lib/useCall';

export interface CallScreenProps {
  state: CallState;
  peerName: string;
  onHangup: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenshare: () => void;
}

/** Phase label shown under the peer name while not yet connected. */
function phaseLabel(state: CallState): string | null {
  switch (state.phase) {
    case 'inviting': return 'Calling…';
    case 'ringing': return 'Incoming call…';
    case 'connecting': return 'Connecting…';
    case 'ended': return 'Call ended';
    default: return null;
  }
}

export function CallScreen({
  state, peerName, onHangup, onToggleMic, onToggleCam, onToggleScreenshare,
}: CallScreenProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const rtc = getWebRTC();
  const RTCView = rtc?.RTCView;
  const visible = state.phase !== 'idle' && state.phase !== 'ringing';
  if (!visible) return null;

  const status = phaseLabel(state);
  const showRemoteVideo = !!RTCView && !!state.remoteUrl && state.media.video;
  const showLocalVideo = !!RTCView && !!state.localUrl && state.camOn;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onHangup}>
      <Box flex={1} background={pal.bg}>
        {/* Remote video / placeholder fills the screen. */}
        <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {showRemoteVideo && RTCView ? (
            <RTCView streamURL={state.remoteUrl as string} style={{ flex: 1 }} objectFit="cover" />
          ) : (
            <Box flex={1} align="center" justify="center" gap={12}>
              <Icon name="phone" size={48} color={pal.border} />
              <Text size="6xl" weight="semibold" color={pal.text}>{peerName}</Text>
              {status ? <Text size="lg" color={pal.border}>{status}</Text> : null}
            </Box>
          )}
        </Box>

        {/* Self-preview inset (top-right), only with a live local video track. */}
        {showLocalVideo && RTCView ? (
          <Box
            style={{
              position: 'absolute', top: insets.top + 12, right: 16,
              width: 104, height: 152, borderRadius: 14, overflow: 'hidden',
              borderWidth: 1, borderColor: pal.border,
            }}
          >
            <RTCView streamURL={state.localUrl as string} style={{ flex: 1 }} objectFit="cover" zOrder={1} mirror />
          </Box>
        ) : null}

        {/* Peer name overlay (when remote video is showing). */}
        {showRemoteVideo ? (
          <Box style={{ position: 'absolute', top: insets.top + 12, left: 16 }}>
            <Text size="4xl" weight="semibold" color="#ffffff">{peerName}</Text>
            {status ? <Text size="md" color="#ffffff">{status}</Text> : null}
          </Box>
        ) : null}

        {/* Control bar. */}
        <Row
          gap={18}
          align="center"
          justify="center"
          style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 24 }}
        >
          <Button pill size="lg" variant={state.micOn ? 'secondary' : 'primary'} onPress={onToggleMic}
            icon={<Icon name="microphone" size={24} color={pal.text} />} />
          {state.media.video ? (
            <Button pill size="lg" variant={state.camOn ? 'secondary' : 'primary'} onPress={onToggleCam}
              icon={<Icon name="videoCamera" size={24} color={pal.text} />} />
          ) : null}
          <Button pill size="lg" variant={state.sharingScreen ? 'primary' : 'secondary'} onPress={onToggleScreenshare}
            icon={<Icon name="stop" size={22} color={pal.text} />} />
          <Button pill size="lg" tintBg={pal.danger} tintFg="#ffffff" onPress={onHangup}
            icon={<Icon name="phone" size={24} color="#ffffff" />} />
        </Row>
      </Box>
    </Modal>
  );
}
