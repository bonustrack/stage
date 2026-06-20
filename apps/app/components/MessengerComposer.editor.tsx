/** @file ComposerEditor + attach menu for the MessengerComposer: the textarea / recording-waveform input row, the [+ / mic / send] buttons, and the attachment menu. */

import type { RefObject } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Animated, type PanResponderInstance } from 'react-native';
import { Pressable } from '@stage-labs/kit/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/scroll';
import { Textarea } from '@stage-labs/kit/textarea';
import { Text } from '@stage-labs/kit/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/icon';
import { Button } from '@stage-labs/kit/button';
import { Spacer } from '@stage-labs/kit/spacer';
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
  textareaH: number; setTextareaH: (h: number) => void;
  inputRef: RefObject<React.ComponentRef<typeof Textarea> | null>;
  attachMenuOpen: boolean; setAttachMenuOpen: (fn: (o: boolean) => boolean) => void;
  /** Quick-access shortcut: icon of the last-used attachment type + its handler. Both undefined until the user has picked an attachment once → button hidden. */
  quickIcon?: HeroIconName; onQuick?: () => void;
  /** Any staged content (text or attachment): the send button is rendered only when true, and when rendered it is always enabled/tappable. */
  hasContent: boolean;
  onCancelRec: () => void; onStopRec: () => void; onSend: () => void;
}

/** A circular 38px icon button used in the composer button row. */
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

/** Renders the top input slot: the recording waveform while recording, else the textarea. */
function ComposerInputSlot({ p }: { p: EditorProps }): React.ReactElement {
  const { dark, head, sub } = p;
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
      <Textarea
        ref={p.inputRef}
        value={p.text} onChangeText={p.setText} placeholder="Message" placeholderTextColor={sub}
        autoResize={false} dark={dark}
        inputProps={{
          onContentSizeChange: (e) => { p.setTextareaH(e.nativeEvent.contentSize.height); },
          selection: p.selection,
          onSelectionChange: (e) => { p.setSelection(e.nativeEvent.selection); },
        }}
        style={{ color: head, fontFamily: 'Calibre-Medium', fontSize: fontSize('3xl'), lineHeight: 23, minHeight: 24, maxHeight: 210, height: undefined, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8, textAlignVertical: 'top', backgroundColor: 'transparent', borderWidth: 0 }}
      />
    </Box>
  );
}

/** Renders the left controls of the button row: cancel (recording) or attach + quick-access. */
function ComposerLeftControls({ p }: { p: EditorProps }): React.ReactElement {
  const { fg, chipBg } = p;
  if (p.recording) return <ComposerBtn icon="x" onPress={p.onCancelRec} fg={fg} chipBg={chipBg} />;
  const showQuick = !p.attachMenuOpen && !!p.quickIcon && !!p.onQuick;
  return (
    <>
      {/* + first; negative marginRight pulls the quick-access icon tight against it (only when shown). */}
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

/** Renders the right action button of the row: confirm (recording) or send, or nothing. */
function ComposerRightAction({ p, primary }: { p: EditorProps; primary: string }): React.ReactElement | null {
  const { dark, bg } = p;
  if (p.recording) {
    return (
      <Button variant="primary" size="md" pill dark={dark} tintBg={primary}
        onPress={p.onStopRec} icon={<Icon name="check" size={20} color={bg} />} />
    );
  }
  /** Shown only with content to send and always enabled; tapping send clears content synchronously so this unmounts instantly (no disabled flash). */
  if (!p.hasContent) return null;
  return (
    <Button variant="primary" size="md" pill dark={dark} tintBg={primary}
      onPress={p.onSend} icon={<Icon name="arrowSmUp" size={20} color={bg} />} />
  );
}

/** Renders the composer's text input row with attach, quick-action, and send/record buttons. */
export function ComposerEditor(p: EditorProps): React.ReactElement {
  const { fg, recording } = p;
  const { primary } = usePalette();
  return (
    <Col padding={10} surface="raised" radius="none">
      <ComposerInputSlot p={p} />
      {/* Fixed 40px row height keeps the composer the same height whether the send button is mounted or not. */}
      <Row align="center" gap={4} height={40}>
        <ComposerLeftControls p={p} />
        <Spacer/>
        {/* Mic — both record flows, mounted across recording so the gesture survives. */}
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

/** [icon, label, handler] for every + menu entry. Shared by the menu and the quick-access shortcut so both stay in lock-step. */
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

/** Renders the attachment action menu (photo, file, location, poll, sign, payment). */
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
