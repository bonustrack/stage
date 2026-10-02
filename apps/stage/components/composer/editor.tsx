
import { useState } from 'react';
import { Platform, type GestureResponderEvent, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { TextField } from '@stage-labs/kit/react-native/text-field';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Button } from '@stage-labs/kit/react-native/button';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { VoiceRecorder } from '@stage-labs/kit/react-native/voice-recorder';
import { Box, Col, PAGE_GUTTER } from '../layout';
import { AnchoredMenu, menuPointAbove } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuRow } from '../MenuRows';
import { IconArrowUp } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowUp';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { IconCamera1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCamera1';
import { IconChart3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChart3';
import { IconImages1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconImages1';
import { IconMapPin } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMapPin';
import { IconPaperclip3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperclip3';
import { IconPencil } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPencil';
import { IconWallet4 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet4';

const COMPOSER_ICON_INSET = 7;
import { usePalette } from '../../lib/theme';
import { useHover } from '../hover';
import { HoverTooltip } from '../HoverTooltip';

interface EditorProps {
  dark: boolean; fg: string; head: string; bg: string; sub: string; chipBg: string;
  recording: boolean; levels: number[]; recordSecs: number;
  slideThresholdPx: number;
  text: string; setText: (v: string) => void;
  selection: { start: number; end: number };
  setSelection: (s: { start: number; end: number }) => void;
  focusNonce: number; blurNonce: number;
  attachMenuOpen: boolean; setAttachMenuOpen: (fn: (o: boolean) => boolean) => void;
  attachActions?: [CentralIcon, string, () => void | Promise<void>][];
  quickIcon?: CentralIcon; quickLabel?: string; onQuick?: () => void;
  hasContent: boolean;
  busy?: boolean;
  placeholder?: string;
  rounded?: boolean;
  onMentionKey?: (key: string, shift: boolean) => boolean;
  onStartRec: () => void; onCancelRec: () => void; onStopRec: () => void; onSend: () => void;
}

function ComposerBtn({ icon, label, onPress, fg, hoverFg, chipBg, mr }: {
  icon: CentralIcon; label: string; onPress: (e: GestureResponderEvent) => void; fg: string; hoverFg: string; chipBg: string; mr?: number;
}): React.ReactElement {
  const { hovered, hoverProps } = useHover();
  return (
    <HoverTooltip label={label}>
    <Pressable accessibilityLabel={label} onPress={onPress} {...hoverProps} style={({ pressed }) => ({
      width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
      backgroundColor: pressed ? chipBg : 'transparent', marginRight: mr,
    })}>
      <Glyph icon={icon} size={24} color={hovered ? hoverFg : fg}/>
    </Pressable>
    </HoverTooltip>
  );
}

interface WebKeyEvent {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
  nativeEvent: { isComposing?: boolean; keyCode?: number };
}

function makeWebEnterToSend(
  p: EditorProps,
): ((event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void) | undefined {
  if (Platform.OS !== 'web') return undefined;
  return (event) => {
    const e = event as unknown as WebKeyEvent;
    if (e.nativeEvent.isComposing === true || e.nativeEvent.keyCode === 229) return;
    if (p.onMentionKey?.(e.key, e.shiftKey) === true) {
      e.preventDefault();
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (p.hasContent && p.busy !== true) p.onSend();
  };
}

function ComposerInputSlot({ p }: { p: EditorProps }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <Box style={{ position: 'relative' }}>
      <TextField
        name="composer"
        value={p.text}
        onKeyPress={makeWebEnterToSend(p)}
        placeholder={p.placeholder ?? 'Message'}
        variant="plain"
        multiline
        autoGrow
        fontSize={fontSize('lg')}
        fontFamily="Calibre-Medium"
        color={p.head}
        placeholderColor={p.sub}
        paddingX={8}
        paddingTop={4}
        paddingBottom={8}
        lineHeight={23}
        minHeight={24}
        maxHeight={210}
        autoCapitalize="sentences"
        focusNonce={p.focusNonce}
        blurNonce={p.blurNonce}
        selection={p.selection}
        dark={dark}
        disabled={p.busy}
        onChangeText={(text) => { p.setText(text); }}
        onSelectionChange={(range) => { p.setSelection({ start: range.start, end: range.end }); }}
      />
    </Box>
  );
}

function ComposerLeftControls({ p }: { p: EditorProps }): React.ReactElement {
  const { fg, chipBg } = p;
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const showQuick = !!p.quickIcon && !!p.onQuick;
  const close = (): void => { p.setAttachMenuOpen(() => false); };
  return (
    <>
      <ComposerBtn
        icon={IconPlusLarge}
        label="Attach"
        onPress={(e) => { setAnchor(menuPointAbove(e)); p.setAttachMenuOpen(() => true); }}
        fg={fg} hoverFg={p.head} chipBg={chipBg}
        mr={showQuick ? -12 : undefined}
      />
      {showQuick && p.quickIcon && p.onQuick
        ? <ComposerBtn icon={p.quickIcon} label={p.quickLabel ?? 'Attach'} onPress={p.onQuick} fg={fg} hoverFg={p.head} chipBg={chipBg} />
        : null}
      <AnchoredMenu visible={p.attachMenuOpen} onClose={close} anchor={anchor}>
        {(p.attachActions ?? []).map(([icon, label, action]) => (
          <MenuRow key={label} icon={icon} label={label} onPress={() => { close(); void action(); }} />
        ))}
      </AnchoredMenu>
    </>
  );
}

function ComposerRightAction({ p, primary }: { p: EditorProps; primary: string }): React.ReactElement | null {
  const { dark, bg } = p;
  if (!p.hasContent) return null;
  return (
    <Button size="md" uniform pill dark={dark} tintBg={primary} loading={p.busy}
      onPress={p.onSend} icon={<Glyph icon={IconArrowUp} size={20} color={bg} />} />
  );
}

export function composerRadius(rounded: boolean | undefined): 'sm' | 'none' {
  return rounded === true ? 'sm' : 'none';
}

export function ComposerEditor(p: EditorProps): React.ReactElement {
  const { primary, border } = usePalette();
  return (
    <Col padding={{ x: PAGE_GUTTER - COMPOSER_ICON_INSET, y: 10 }} background={border} radius={composerRadius(p.rounded)}>
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
        wrapMic={(mic) => <HoverTooltip label="Record voice message">{mic}</HoverTooltip>}
        onStart={p.onStartRec}
        onCancel={p.onCancelRec}
        onComplete={p.onStopRec}
      />
    </Col>
  );
}

type AttachAction = [CentralIcon, string, () => void | Promise<void>];

export function buildAttachActions(a: {
  pickImage: () => void; takePhoto: () => void;
  pickFile: () => void; pickLocation: () => Promise<void>;
  openPoll: () => void; openSig: () => void; openTx: () => void;
}): AttachAction[] {
  return [
    [IconImages1, 'Image', a.pickImage],
    [IconCamera1, 'Camera', a.takePhoto],
    [IconPaperclip3, 'File', a.pickFile],
    [IconMapPin, 'Location', a.pickLocation],
    [IconChart3, 'Poll', a.openPoll],
    [IconPencil, 'Sign', a.openSig],
    [IconWallet4, 'Payment', a.openTx],
  ];
}
