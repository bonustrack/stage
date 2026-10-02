import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconCall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCall';
import { IconCallCancel } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCallCancel';
import { IconMicrophone } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophone';
import { IconMicrophoneOff } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophoneOff';
import type { CallSession } from '@stage-labs/client/xmtp/callMachine';
import { Row, PAGE_GUTTER, pinnedEdges } from '../layout';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { usePalette } from '../../lib/theme';
import { CALL_BAR_HEIGHT } from '../../lib/webLayout';
import { leaveCall, toggleMic } from '../../lib/calls';
import { setCallMinimized, type CallView } from '../../lib/calls.store';
import { callTitle } from './callPeople';
import { CallControl } from './CallControl';
import { callSubtitle } from './CallScreen.model';

const BAR_LAYER = 55;

export function CallBar({ view, session }: { view: CallView; session: CallSession }): React.ReactElement {
  const top = useSafeAreaInsets().top - CALL_BAR_HEIGHT;
  const { border, success } = usePalette();
  const connected = view.peers.filter((p) => p.status === 'connected').length;
  const muted = !view.media.audio;
  return (
    <Row
      align="center" gap={10} height={CALL_BAR_HEIGHT} padding={{ x: PAGE_GUTTER }} surface="raised"
      border={{ bottom: { width: 1, color: border } }} style={pinnedEdges({ top, left: 0, right: 0 }, BAR_LAYER)}
    >
      <Pressable
        accessibilityRole="button" accessibilityLabel="Open call" onPress={() => { setCallMinimized(false); }}
        style={{ flex: 1, alignSelf: 'stretch' }}
      >
        <Row flex={1} align="center" gap={8}>
          <Glyph icon={IconCall} size={16} color={success}/>
          <Text size="sm" weight="semibold" value={callTitle(session.convId).text} maxLines={1} style={{ flexShrink: 1 }}/>
          <Text size="xs" role="success" value={callSubtitle(connected, Date.now() - session.startedMs)} maxLines={1}/>
        </Row>
      </Pressable>
      <CallControl
        size="sm" placement="below" icon={muted ? IconMicrophoneOff : IconMicrophone}
        label={muted ? 'Unmute' : 'Mute'} active={muted} onPress={toggleMic}
      />
      <CallControl size="sm" placement="below" icon={IconCallCancel} label="Leave call" active={false} danger onPress={leaveCall}/>
    </Row>
  );
}
