
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import { VoiceRecorder } from '@stage-labs/kit/react-native/voice-recorder';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import { composerInput, COMPOSER_CHANGE, COMPOSER_SELECTION } from '@stage-labs/views';
import { Box, Col } from './layout';
import { usePalette, useRadius } from '../lib/theme';

interface EditorProps {
  dark: boolean; fg: string; head: string; bg: string; sub: string; inputBg: string; chipBg: string;
  recording: boolean; levels: number[]; recordSecs: number;
  slideThresholdPx: number;
  text: string; setText: (v: string) => void;
  selection: { start: number; end: number };
  setSelection: (s: { start: number; end: number }) => void;
  focusNonce: number; blurNonce: number;
  attachMenuOpen: boolean; setAttachMenuOpen: (fn: (o: boolean) => boolean) => void;
  quickIcon?: HeroIconName; onQuick?: () => void;
  hasContent: boolean;
  onStartRec: () => void; onCancelRec: () => void; onStopRec: () => void; onSend: () => void;
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
  return (
    <Box style={{ position: 'relative' }}>
      <KitRenderer node={composerInputNode(p)} registry={composerInputRegistry(p)} />
    </Box>
  );
}

function ComposerLeftControls({ p }: { p: EditorProps }): React.ReactElement {
  const { fg, chipBg } = p;
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
  if (!p.hasContent) return null;
  return (
    <Button variant="primary" size="md" pill dark={dark} tintBg={primary}
      onPress={p.onSend} icon={<Icon name="arrowSmUp" size={20} color={bg} />} />
  );
}

export function ComposerEditor(p: EditorProps): React.ReactElement {
  const { primary } = usePalette();
  return (
    <Col padding={10} surface="raised" radius="none">
      <VoiceRecorder
        recording={p.recording}
        levels={p.levels}
        recordSecs={p.recordSecs}
        slideThresholdPx={p.slideThresholdPx}
        fg={p.fg} head={p.head} sub={p.sub} bg={p.bg} chipBg={p.chipBg} primary={primary}
        dark={p.dark}
        inputSlot={<ComposerInputSlot p={p} />}
        leftControls={<ComposerLeftControls p={p} />}
        rightAction={<ComposerRightAction p={p} primary={primary} />}
        onStart={p.onStartRec}
        onCancel={p.onCancelRec}
        onComplete={p.onStopRec}
      />
    </Col>
  );
}

export type AttachAction = [HeroIconName, string, () => void | Promise<void>];

export function buildAttachActions(a: {
  pickImage: () => void; takePhoto: () => void;
  pickFile: () => void; pickLocation: () => Promise<void>;
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
