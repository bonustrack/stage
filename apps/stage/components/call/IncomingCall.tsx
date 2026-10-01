import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconCall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCall';
import { IconCallCancel } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCallCancel';
import type { CallInfo, CallSession } from '@stage-labs/client/xmtp/callMachine';
import { Avatar } from '../Avatar';
import { Col, Row, pinnedEdges } from '../layout';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { declineCall, joinCall } from '../../lib/calls';
import { ignore } from '../../lib/errorPolicy';
import { callPerson, callTitle } from './callPeople';

export function IncomingCall({ session, info, selfInboxId }: {
  session: CallSession; info: CallInfo | undefined; selfInboxId: string | null;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { border, success, danger, bg } = usePalette();
  const top = useSafeAreaInsets().top;
  const caller = callPerson(session.convId, info?.callerInboxId ?? '', selfInboxId);
  const kind = session.video ? 'video call' : 'voice call';
  const where = session.dm ? `Incoming ${kind}` : `Incoming ${kind} in ${callTitle(session.convId).text}`;
  return (
    <Row justify="center" style={pinnedEdges({ top: 12 + top, left: 12, right: 12 }, 70)}>
      <Col
        surface="raised" radius={16} padding={16} gap={14} width="100%" maxWidth={420}
        style={{ borderWidth: 1, borderColor: border }} accessibilityRole="alert"
      >
        <Row align="center" gap={12}>
          <Avatar address={caller.address} size={44}/>
          <Col flex={1}>
            <Text weight="semibold" value={caller.name} maxLines={1}/>
            <Text size="sm" role="secondary" value={where} maxLines={2}/>
          </Col>
        </Row>
        <Row gap={10}>
          <Button
            size="lg" pill dark={dark} label="Decline" tintBg={danger} tintFg={bg} style={{ flex: 1 }}
            iconStart={<Glyph icon={IconCallCancel} size={18} color={bg}/>} onPress={declineCall}
          />
          <Button
            size="lg" pill dark={dark} label="Accept" tintBg={success} tintFg={bg} style={{ flex: 1 }}
            iconStart={<Glyph icon={IconCall} size={18} color={bg}/>}
            onPress={() => { ignore(joinCall(session.convId, session.dm), 'ui'); }}
          />
        </Row>
      </Col>
    </Row>
  );
}
