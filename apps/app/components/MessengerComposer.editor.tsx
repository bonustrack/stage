
import { fontSize } from '@stage-labs/kit/tokens';
import { Animated, type PanResponderInstance } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { Spacer } from '@stage-labs/kit/react-native/spacer';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import { composerInput, COMPOSER_CHANGE, COMPOSER_SELECTION } from '@stage-labs/views';
import { Box, Row, Col } from './layout';
import { usePalette, useRadius } from '../lib/theme';
import { RecordingBar } from './MessengerComposer.parts';

interface EditorProps {
  dark: boolean; fg: string; head: string; bg: string; sub: string; inputBg: string; chipBg: string;
  recording: boolean; levels: number[]; recordSecs: number;
  slideX: Animated.Value; slideThresholdPx: number; micPanResponder: PanResponderInstance;
  text: string; setText: (v: string) => void;
  selection: { start: number; end: number };
  setSelection: (s: { start: number; end: number }) => void;
  focusNonce: number; blurNonce: number;
  attachMenuOpen: boolean; setAttachMenuOpen: (fn: (o: boolean) => boolean) => void;
  quickIcon?: HeroIconName; onQuick?: () => void;
  hasContent: boolean;
  onCancelRec: () => void; onStopRec: () => void; onSend: () => void;
}

function composerInputNode(p: EditorProps): WidgetRoot {
  return {
    type: 'Basic',
    children: [
      composerInput({
        value: p.text,
        color: p.head,
        placeholderColor: p.sub,
        fontSize: fontSize('3xl'),
        selStart: p.selection.start,
        selEnd: p.selection.end,
        focusNonce: p.focusNonce,
        blurNonce: p.blurNonce,
      }),
    ],
  };
}

function composerInputRegistry(p: EditorProps): WidgetActionRegistry {
  return {
    [COMPOSER_CHANGE]: (a) => {
      const next = a.payload.composer;
      if (typeof next === 'string') p.setText(next);
    },
    [COMPOSER_SELECTION]: (a) => {
      const { start, end } = a.payload;
      if (typeof start === 'number' && typeof end === 'number') {
        p.setSelection({ start, end });
      }
    },
  };
}

function ComposerBtn({ icon, onPress, fg, chipBg, mr }: {
  icon: HeroIconName; onPress: () => void; fg: string; chipBg: string; mr?: number;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
      backgroundColor: pressed ? chipBg : 'transparent', marginRight: mr,
    })}>
      <Icon name={icon} size={22} color={fg}/>
    </Pressable>
  );
}

function ComposerInputSlot({ p }: { p: EditorProps }): React.ReactElement {
  const { head, sub } = p;
  if (p.recording) {
    return (
      <RecordingBar
        head={head} sub={sub} levels={p.levels} recordSecs={p.recordSecs}
        slideX={p.slideX} slideThresholdPx={p.slideThresholdPx}
      />
    );
  }
  return (
    <Box style={{ position: 'relative' }}>
      <KitRenderer node={composerInputNode(p)} registry={composerInputRegistry(p)} />
    </Box>
  );
}

function ComposerLeftControls({ p }: { p: EditorProps }): React.ReactElement {
  const { fg, chipBg } = p;
  if (p.recording) return <ComposerBtn icon="x" onPress={p.onCancelRec} fg={fg} chipBg={chipBg} />;
  const showQuick = !p.attachMenuOpen && !!p.quickIcon && !!p.onQuick;
  return (
    <>
      {}
      <ComposerBtn
        icon={p.attachMenuOpen ? 'x' : 'plus'}
        onPress={() => { p.setAttachMenuOpen(o => !o); }}
        fg={fg} chipBg={chipBg}
        mr={showQuick ? -12 : undefined}
      />
      {showQuick && p.quickIcon && p.onQuick
        ? <ComposerBtn icon={p.quickIcon} onPress={p.onQuick} fg={fg} chipBg={chipBg} />
        : null}
    </>
  );
}

function ComposerRightAction({ p, primary }: { p: EditorProps; primary: string }): React.ReactElement | null {
  const { dark, bg } = p;
  if (p.recording) {
    return (
      <Button variant="primary" size="md" pill dark={dark} tintBg={primary}
        onPress={p.onStopRec} icon={<Icon name="check" size={20} color={bg} />} />
    );
  }
  if (!p.hasContent) return null;
  return (
    <Button variant="primary" size="md" pill dark={dark} tintBg={primary}
      onPress={p.onSend} icon={<Icon name="arrowSmUp" size={20} color={bg} />} />
  );
}

export function ComposerEditor(p: EditorProps): React.ReactElement {
  const { fg, recording } = p;
  const { primary } = usePalette();
  return (
    <Col padding={10} surface="raised" radius="none">
      <ComposerInputSlot p={p} />
      {}
      <Row align="center" gap={4} height={40}>
        <ComposerLeftControls p={p} />
        <Spacer/>
        {}
        <Animated.View
          {...p.micPanResponder.panHandlers}
          style={{
            width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
            backgroundColor: recording ? '#e2622f' : 'transparent',
            transform: [{ translateX: p.slideX }],
          }}
        >
          <Icon name="microphone" size={22} color={recording ? '#ffffff' : fg}/>
        </Animated.View>
        <ComposerRightAction p={p} primary={primary} />
      </Row>
    </Col>
  );
}

export type AttachAction = [HeroIconName, string, () => void | Promise<void>];

export function buildAttachActions(a: {
  pickImage: () => Promise<void>; takePhoto: () => Promise<void>;
  pickFile: () => Promise<void>; pickLocation: () => Promise<void>;
  openPoll: () => void; openSig: () => void; openTx: () => void;
}): AttachAction[] {
  return [
    ['photo', 'Image', a.pickImage],
    ['camera', 'Camera', a.takePhoto],
    ['paperClip', 'File', a.pickFile],
    ['mapPin', 'Location', a.pickLocation],
    ['chartBar', 'Poll', a.openPoll],
    ['pencil', 'Sign', a.openSig],
    ['wallet', 'Payment', a.openTx],
  ];
}

export function AttachMenu({
  head, inputBg, chipBg, actions, onClose,
}: {
  head: string; inputBg: string; chipBg: string;
  actions: [HeroIconName, string, () => void | Promise<void>][];
  onClose: () => void;
}): React.ReactElement {
  const btnRadius = useRadius();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 16, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 2 }}
>
      {actions.map(([icon, label, action]) => (
        <Col key={label} align="center" gap={6}>
          <Pressable
            onPress={() => { onClose(); void action(); }}
            style={({ pressed }) => ({
              width: 56, height: 56, borderRadius: Math.min(btnRadius, 28),
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? chipBg : inputBg,
              borderWidth: 1, borderColor: chipBg,
            })}
>
            <Icon name={icon} size={26} color={head}/>
          </Pressable>
          <Text weight="semibold" size="sm" color={head} numberOfLines={1}>{label}</Text>
        </Col>
      ))}
    </ScrollView>
  );
}
