import { useEffect, useReducer } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Card } from '@stage-labs/kit/react-native/card';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { IconCall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCall';
import { IconVideo } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconVideo';
import { Box } from '../layout';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { joinCall } from '../../lib/calls';
import { setCallMinimized, useCallView } from '../../lib/calls.store';
import { ignore } from '../../lib/errorPolicy';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { callCardModel, callLiveOf, type CallCardModel, type CallRecord } from './callCard.model';
import { ATTACHMENT_MAX_WIDTH } from './imageBox.model';
import { IconTileRow } from '../MediaCard';

const TICK_MS = 1_000;

function useTicking(ticking: boolean): void {
  const [, render] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(render, TICK_MS);
    return (): void => { clearInterval(id); };
  }, [ticking]);
}

function toneColor(model: CallCardModel, pal: ReturnType<typeof usePalette>): string {
  if (model.tone === 'live') return pal.success;
  return model.tone === 'missed' ? pal.danger : pal.text;
}

export function CallCard({ record, line }: { record: CallRecord; line: string }): React.ReactElement {
  const scheme = useKitScheme();
  const pal = usePalette();
  const view = useCallView();
  const { hovered, hoverProps } = useHover();
  const convId = convIdOfLine(line);
  const nowMs = Date.now();
  const model = callCardModel(record, callLiveOf(view.calls, convId ?? '', record, nowMs), nowMs);
  useTicking(model.tone === 'live');
  const pressable = convId !== null && model.action !== null;
  const onPress = (): void => {
    if (convId !== null && model.action === 'join') ignore(joinCall(convId, record.dm), 'ui');
    if (model.action === 'open') setCallMinimized(false);
  };
  return (
    <Pressable
      testID="call-card" accessibilityRole="button" accessibilityLabel={`${model.title}, ${model.status}`}
      accessibilityState={{ disabled: !pressable }} disabled={!pressable} onPress={onPress}
      pressedOpacity={0.85} style={{ width: '100%', maxWidth: ATTACHMENT_MAX_WIDTH }} {...hoverProps}
    >
      <Card dark={scheme === 'dark'} background={pal.bg} padding={12}>
        <IconTileRow
          title={model.title} titleColor={hovered && pressable ? pal.link : pal.text} subtitle={model.status} tabular
          icon={<Glyph icon={record.video ? IconVideo : IconCall} size={24} color={toneColor(model, pal)}/>}
        >
          {pressable && model.action === 'join' ? (
            <Box pointerEvents="none" aria-hidden>
              <Button size="sm" pill label="Join" tintBg={pal.success} tintFg={pal.bg} focusable={false}/>
            </Box>
          ) : null}
        </IconTileRow>
      </Card>
    </Pressable>
  );
}
