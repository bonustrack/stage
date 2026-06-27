
import { useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder } from 'react-native';
import { Box, Row } from './box';
import { Button } from './button';
import { Icon } from './icon';
import { Pressable } from './pressable';
import { Spacer } from './spacer';
import { Text } from './text';

export const SLIDE_CANCEL_THRESHOLD_PX = 80;

export interface VoiceRecorderProps {
  recording: boolean;
  levels?: number[];
  recordSecs?: number;
  slideThresholdPx?: number;
  fg: string;
  head: string;
  sub: string;
  bg: string;
  chipBg: string;
  primary: string;
  dark?: boolean;
  inputSlot: ReactNode;
  leftControls: ReactNode;
  rightAction: ReactNode;
  onStart?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
}

function RecordingBar({ head, sub, levels, recordSecs, slideX, slideThresholdPx }: {
  head: string; sub: string; levels: number[]; recordSecs: number;
  slideX: Animated.Value; slideThresholdPx: number;
}): React.ReactElement {
  return (
    <Row height={28} padding={{ x: 4 }} align="center">
      <Animated.View style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        transform: [{ translateX: slideX }],
        opacity: slideX.interpolate({
          inputRange: [-slideThresholdPx, -16, 0],
          outputRange: [1, 0.7, 0.4],
          extrapolate: 'clamp',
        }),
      }}>
        <Icon name="arrowLeft" size={14} color={sub}/>
        <Text size="xs" role="secondary">
          Slide to cancel
        </Text>
      </Animated.View>
      <Row height={28} flex={1} align="center" justify="end" style={{ overflow: 'hidden' }}>
        {[...(Array<number>(Math.max(0, 40 - levels.length)).fill(0.05)), ...levels].slice(-40).map((lvl, i) => (
          <Box width={3} radius="2xs" height={Math.max(3, Math.round(lvl * 26))} background={head} margin={{ x: 1 }} key={i} style={{ opacity: 0.85 }}/>
        ))}
      </Row>
      <Text size="xs" role="secondary" style={{ minWidth: 40, textAlign: 'center' }}>
        {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, '0')}
      </Text>
    </Row>
  );
}

function CancelBtn({ onPress, fg, chipBg }: {
  onPress: () => void; fg: string; chipBg: string;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
      backgroundColor: pressed ? chipBg : 'transparent',
    })}>
      <Icon name="x" size={22} color={fg}/>
    </Pressable>
  );
}

export function VoiceRecorder(props: VoiceRecorderProps): React.ReactElement {
  const {
    recording, slideThresholdPx = SLIDE_CANCEL_THRESHOLD_PX, onStart, onCancel, onComplete,
  } = props;

  const micPressStart = useRef(0);
  const recordingRef = useRef(false);
  const pressingRef = useRef(false);
  if (!pressingRef.current) recordingRef.current = recording;
  const slideX = useRef(new Animated.Value(0)).current;
  const slideXRef = useRef(0);
  const handlersRef = useRef({ onStart, onCancel, onComplete });
  handlersRef.current = { onStart, onCancel, onComplete };

  const fireStart = (): void => { recordingRef.current = true; handlersRef.current.onStart?.(); };
  const fireCancel = (): void => { recordingRef.current = false; handlersRef.current.onCancel?.(); };
  const fireComplete = (): void => { recordingRef.current = false; handlersRef.current.onComplete?.(); };
  const fireRef = useRef({ fireStart, fireCancel, fireComplete });
  fireRef.current = { fireStart, fireCancel, fireComplete };

  const micPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pressingRef.current = true;
      micPressStart.current = Date.now();
      slideXRef.current = 0;
      slideX.setValue(0);
      if (recordingRef.current) { fireRef.current.fireComplete(); return; }
      fireRef.current.fireStart();
    },
    onPanResponderMove: (_, g) => {
      const dx = Math.max(-120, Math.min(0, g.dx));
      slideXRef.current = dx;
      slideX.setValue(dx);
    },
    onPanResponderRelease: () => {
      pressingRef.current = false;
      const dx = slideXRef.current;
      const held = Date.now() - micPressStart.current;
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
      slideXRef.current = 0;
      if (!recordingRef.current) return;
      if (dx <= -slideThresholdPx) { fireRef.current.fireCancel(); return; }
      if (held >= 350) fireRef.current.fireComplete();
    },
    onPanResponderTerminate: () => {
      pressingRef.current = false;
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
      slideXRef.current = 0;
    },
    onPanResponderTerminationRequest: () => false,
  }), []);

  return (
    <RecorderView
      props={props}
      slideX={slideX}
      panHandlers={micPanResponder.panHandlers}
      onCancelPress={() => { fireCancel(); }}
      onCompletePress={() => { fireComplete(); }}
    />
  );
}

function MicView({ recording, fg, slideX, panHandlers }: {
  recording: boolean; fg: string; slideX: Animated.Value;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
}): React.ReactElement {
  return (
    <Animated.View
      {...panHandlers}
      style={{
        width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
        backgroundColor: recording ? '#e2622f' : 'transparent',
        transform: [{ translateX: slideX }],
      }}
    >
      <Icon name="microphone" size={22} color={recording ? '#ffffff' : fg}/>
    </Animated.View>
  );
}

function RecorderView({ props, slideX, panHandlers, onCancelPress, onCompletePress }: {
  props: VoiceRecorderProps;
  slideX: Animated.Value;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  onCancelPress: () => void;
  onCompletePress: () => void;
}): React.ReactElement {
  const {
    recording, levels = [], recordSecs = 0, fg, head, sub, bg, chipBg, primary, dark = false,
    inputSlot, leftControls, rightAction, slideThresholdPx = SLIDE_CANCEL_THRESHOLD_PX,
  } = props;
  const mic = <MicView recording={recording} fg={fg} slideX={slideX} panHandlers={panHandlers} />;
  return (
    <Box>
      {recording ? (
        <RecordingBar
          head={head} sub={sub} levels={levels} recordSecs={recordSecs}
          slideX={slideX} slideThresholdPx={slideThresholdPx}
        />
      ) : (
        inputSlot
      )}
      <Row align="center" gap={4} height={40}>
        {recording ? (
          <CancelBtn onPress={onCancelPress} fg={fg} chipBg={chipBg} />
        ) : (
          leftControls
        )}
        <Spacer/>
        {mic}
        {recording ? (
          <Button variant="primary" size="md" pill dark={dark} tintBg={primary}
            onPress={onCompletePress} icon={<Icon name="check" size={20} color={bg} />} />
        ) : (
          rightAction
        )}
      </Row>
    </Box>
  );
}
