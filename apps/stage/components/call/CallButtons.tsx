import { useEffect } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconCall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCall';
import { IconVideo } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconVideo';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { callsSupported, joinCall, loadCallHistory, startCall } from '../../lib/calls';
import { joinableCall, useCallView } from '../../lib/calls.store';
import { ignore } from '../../lib/errorPolicy';

function HeaderIcon({ label, icon, disabled, onPress }: {
  label: string; icon: typeof IconCall; disabled: boolean; onPress: () => void;
}): React.ReactElement {
  const { text, link, sub } = usePalette();
  const hover = useHover();
  const color = disabled ? sub : hover.hovered ? link : text;
  return (
    <HoverTooltip label={label} placement="below">
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={8} {...hover.hoverProps}>
        <Glyph icon={icon} size={24} color={color}/>
      </Pressable>
    </HoverTooltip>
  );
}

export function CallButtons({ convId, isGroup }: { convId: string; isGroup: boolean }): React.ReactElement | null {
  const view = useCallView();
  const { success, bg } = usePalette();
  useEffect(() => { ignore(loadCallHistory(convId), 'optional'); }, [convId]);
  if (!callsSupported) return null;
  const joinable = joinableCall(view, convId);
  if (joinable) {
    return (
      <Button
        size="sm" pill label="Join call" tintBg={success} tintFg={bg}
        iconStart={<Glyph icon={IconCall} size={16} color={bg}/>}
        disabled={view.calls.session !== null}
        onPress={() => { ignore(joinCall(convId, !isGroup), 'ui'); }}
      />
    );
  }
  const busy = view.calls.session !== null;
  return (
    <Row align="center" gap={18}>
      <HeaderIcon label="Voice call" icon={IconCall} disabled={busy} onPress={() => { ignore(startCall(convId, !isGroup, false), 'ui'); }}/>
      <HeaderIcon label="Video call" icon={IconVideo} disabled={busy} onPress={() => { ignore(startCall(convId, !isGroup, true), 'ui'); }}/>
    </Row>
  );
}
