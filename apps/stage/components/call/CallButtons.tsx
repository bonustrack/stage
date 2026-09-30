import { useEffect, useReducer, useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconCall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCall';
import { IconVideo } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconVideo';
import { HoverTooltip } from '../HoverTooltip';
import { useHover } from '../hover';
import { AnchoredMenu, menuPointBelowEnd } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuRow } from '../MenuRows';
import { usePalette } from '../../lib/theme';
import { callsSupported, joinCall, loadCallHistory, startCall } from '../../lib/calls';
import { useCallView } from '../../lib/calls.store';
import { CALL_RING_TIMEOUT_MS, CALL_STALE_MS } from '@stage-labs/client/xmtp/call';
import { joinableCall } from '@stage-labs/client/xmtp/callMachine';
import { ignore } from '../../lib/errorPolicy';

function CallMenu({ convId, isGroup, disabled }: {
  convId: string; isGroup: boolean; disabled: boolean;
}): React.ReactElement {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const { text, link, sub } = usePalette();
  const hover = useHover();
  const color = disabled ? sub : hover.hovered ? link : text;
  useEffect(() => { if (disabled) setAnchor(null); }, [disabled]);
  const close = (): void => { setAnchor(null); };
  const start = (video: boolean): void => {
    close();
    if (!disabled) ignore(startCall(convId, !isGroup, video), 'ui');
  };
  return (
    <>
      <HoverTooltip label="Call" placement="below">
        <Pressable
          accessibilityRole="button" accessibilityLabel="Call"
          accessibilityState={{ disabled }} aria-expanded={anchor !== null && !disabled}
          disabled={disabled} onPress={(e) => { setAnchor(menuPointBelowEnd(e)); }} hitSlop={8} {...hover.hoverProps}
        >
          <Glyph icon={IconCall} size={24} color={color}/>
        </Pressable>
      </HoverTooltip>
      <AnchoredMenu visible={anchor !== null && !disabled} onClose={close} anchor={anchor}>
        <MenuRow label="Voice call" icon={IconCall} onPress={() => { start(false); }}/>
        <MenuRow label="Video call" icon={IconVideo} onPress={() => { start(true); }}/>
      </AnchoredMenu>
    </>
  );
}

function useRenderAt(atMs: number | null): void {
  const [, render] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (atMs === null) return;
    const id = setTimeout(render, Math.max(0, atMs - Date.now()) + 100);
    return (): void => { clearTimeout(id); };
  }, [atMs]);
}

export function CallButtons({ convId, isGroup }: { convId: string; isGroup: boolean }): React.ReactElement | null {
  const view = useCallView();
  const { success, bg } = usePalette();
  useEffect(() => { ignore(loadCallHistory(convId), 'optional'); }, [convId]);
  const joinable = joinableCall(view.calls, convId, Date.now(), !isGroup);
  useRenderAt(joinable ? joinable.lastMs + (isGroup ? CALL_STALE_MS : CALL_RING_TIMEOUT_MS) : null);
  if (!callsSupported) return null;
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
  return <CallMenu key={convId} convId={convId} isGroup={isGroup} disabled={view.calls.session !== null}/>;
}
