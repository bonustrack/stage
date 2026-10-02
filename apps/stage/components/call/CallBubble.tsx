import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconCall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCall';
import { IconCallCancel } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCallCancel';
import { IconMicrophone } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophone';
import { IconMicrophoneOff } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophoneOff';
import type { CallSession } from '@stage-labs/client/xmtp/callMachine';
import { Col, Row, PAGE_GUTTER, pinnedBottom } from '../layout';
import { useFloatingBottom } from '../layout/floatingBottom';
import { OVERLAY_SHADOW } from '@stage-labs/kit/overlay.styles';
import { usePalette } from '../../lib/theme';
import { leaveCall, toggleMic } from '../../lib/calls';
import { setCallMinimized, type CallView } from '../../lib/calls.store';
import { callTitle } from './callPeople';
import { CallControl } from './CallControl';
import { callSubtitle } from './CallScreen.model';

const BUBBLE_LAYER = 55;
const SHRINK = { flexShrink: 1, minWidth: 0 } as const;

export function CallBubble({ view, session }: { view: CallView; session: CallSession }): React.ReactElement {
  const bottom = useFloatingBottom();
  const { success } = usePalette();
  const connected = view.peers.filter((p) => p.status === 'connected').length;
  const muted = !view.media.audio;
  return (
    <Row justify="end" padding={{ x: PAGE_GUTTER }} pointerEvents="box-none" style={[pinnedBottom(BUBBLE_LAYER), { bottom }]}>
      <Row align="center" gap={8} maxWidth={320} padding={{ left: 14, right: 6, y: 6 }} radius="full" surface="raised" style={OVERLAY_SHADOW}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open call" onPress={() => { setCallMinimized(false); }} style={SHRINK}>
          <Row align="center" gap={10} style={SHRINK}>
            <Glyph icon={IconCall} size={18} color={success}/>
            <Col style={SHRINK}>
              <Text size="2xs" weight="semibold" value={callTitle(session.convId).text} maxLines={1}/>
              <Text size="3xs" role="success" value={callSubtitle(connected, Date.now() - session.startedMs)} maxLines={1}/>
            </Col>
          </Row>
        </Pressable>
        <CallControl size="sm" icon={muted ? IconMicrophoneOff : IconMicrophone} label={muted ? 'Unmute' : 'Mute'} active={muted} onPress={toggleMic}/>
        <CallControl size="sm" icon={IconCallCancel} label="Leave call" active={false} danger onPress={leaveCall}/>
      </Row>
    </Row>
  );
}
