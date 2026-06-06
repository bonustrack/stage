/** Composer input editor (textarea / recording waveform + the [+ / mic / send]
 *  button row) and the attach menu, extracted from MessengerComposer.tsx for the
 *  lint line-budget. JSX + behavior identical — state owned by the parent. */

import type { RefObject } from 'react';
import { Animated, Pressable, ScrollView, TextInput, type PanResponderInstance } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Box, Row, Col } from './layout';
import { usePalette, useBlockRadius, useRadius } from '../lib/theme';
import { ComposerGradient } from './ComposerGradient';
import { RecordingBar } from './MessengerComposer.parts';

interface EditorProps {
  dark: boolean; fg: string; head: string; bg: string; sub: string; inputBg: string; chipBg: string;
  recording: boolean; levels: number[]; recordSecs: number;
  slideX: Animated.Value; slideThresholdPx: number; micPanResponder: PanResponderInstance;
  text: string; setText: (v: string) => void;
  selection: { start: number; end: number };
  setSelection: (s: { start: number; end: number }) => void;
  textareaH: number; setTextareaH: (h: number) => void;
  inputRef: RefObject<TextInput | null>;
  attachMenuOpen: boolean; setAttachMenuOpen: (fn: (o: boolean) => boolean) => void;
  /** Quick-access shortcut: icon of the last-used attachment type + its handler.
   *  Both undefined until the user has picked an attachment once → button hidden. */
  quickIcon?: HeroIconName; onQuick?: () => void;
  canSend: boolean;
  onCancelRec: () => void; onStopRec: () => void; onSend: () => void;
}

export function ComposerEditor(p: EditorProps): React.ReactElement {
  const { dark, fg, head, bg, sub, inputBg, chipBg, recording } = p;
  const { primary } = usePalette();
  const blockRadius = useBlockRadius();
  const Btn = ({ icon, onPress, mr }: { icon: HeroIconName; onPress: () => void; mr?: number }): React.ReactElement => (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
      backgroundColor: pressed ? chipBg : 'transparent', marginRight: mr,
    })}>
      <Icon name={icon} size={22} color={fg} />
    </Pressable>
  );
  return (
    <Col bg={inputBg} radius={blockRadius} p={10}>
      {/** Top slot: live waveform + timer while recording, else the textarea. The
       *   button row below stays mounted across both states. */}
      {recording ? (
        <RecordingBar
          head={head} sub={sub} levels={p.levels} recordSecs={p.recordSecs}
          slideX={p.slideX} slideThresholdPx={p.slideThresholdPx}
        />
      ) : (
        <Box style={{ position: 'relative' }}>
          <TextInput
            ref={p.inputRef}
            value={p.text} onChangeText={p.setText} placeholder="Ask Metro" placeholderTextColor={sub} multiline
            onContentSizeChange={(e) => p.setTextareaH(e.nativeEvent.contentSize.height)}
            selection={p.selection}
            onSelectionChange={(e) => p.setSelection(e.nativeEvent.selection)}
            style={{ color: head, fontFamily: 'Calibre-Medium', fontSize: 19, lineHeight: 23, minHeight: 24, maxHeight: 140, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8, textAlignVertical: 'top' }}
          />
          {p.textareaH > 132 ? (
            <>
              <ComposerGradient bg={inputBg} direction="up" top={0} height={24} />
              <ComposerGradient bg={inputBg} direction="down" bottom={0} height={24} />
            </>
          ) : null}
        </Box>
      )}
      <Row align="center" gap={4}>
        {/** Left: cancel (✕) while recording, else the attach (+) menu toggle. */}
        {recording
          ? <Btn icon="x" onPress={p.onCancelRec} />
          : (
            <>
              {/** + first (leftmost). Negative marginRight pulls the quick-access
               *   icon tight against it — the 38px Btns have wide internal padding,
               *   so this removes the visual slack (the Row gap=4 below would
               *   otherwise leave the pair looking spread). Only apply the pull when
               *   the quick icon is actually shown. */}
              <Btn
                icon={p.attachMenuOpen ? 'x' : 'plus'}
                onPress={() => p.setAttachMenuOpen(o => !o)}
                mr={!p.attachMenuOpen && p.quickIcon && p.onQuick ? -12 : undefined}
              />
              {/** Quick-access: re-trigger the last-used attachment type directly. */}
              {!p.attachMenuOpen && p.quickIcon && p.onQuick
                ? <Btn icon={p.quickIcon} onPress={p.onQuick} />
                : null}
            </>
          )}
        <Box flex={1} />
        {/** Mic — both record flows, mounted across recording so the gesture survives. */}
        <Animated.View
          {...p.micPanResponder.panHandlers}
          style={{
            width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
            backgroundColor: recording ? '#e2622f' : 'transparent',
            transform: [{ translateX: p.slideX }],
          }}
        >
          <Icon name="microphone" size={22} color={recording ? '#ffffff' : fg} />
        </Animated.View>
        {/** Right: ✓ confirm (stop+stage) while recording, else send. A circular
         *   icon-only kit pill (primary) — black/white solid per scheme. */}
        {recording ? (
          <Button
            variant="primary"
            size="md"
            pill
            dark={dark}
            tintBg={primary}
            onPress={p.onStopRec}
            icon={<Icon name="check" size={20} color={bg} />}
          />
        ) : (
          <Button
            variant="primary"
            size="md"
            pill
            dark={dark}
            disabled={!p.canSend}
            tintBg={primary}
            onPress={p.onSend}
            icon={<Icon name="send" size={20} color={bg} />}
          />
        )}
      </Row>
    </Col>
  );
}

export type AttachAction = [HeroIconName, string, () => void | Promise<void>];

/** [icon, label, handler] for every + menu entry. Shared by the menu and the
 *  quick-access shortcut so both stay in lock-step. */
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
            <Icon name={icon} size={26} color={head} />
          </Pressable>
          <Text style={{ color: head, fontSize: 14, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>{label}</Text>
        </Col>
      ))}
    </ScrollView>
  );
}
