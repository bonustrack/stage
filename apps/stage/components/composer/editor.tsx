
import { Platform, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { TextField } from '@stage-labs/kit/react-native/text-field';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Button } from '@stage-labs/kit/react-native/button';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { VoiceRecorder } from '@stage-labs/kit/react-native/voice-recorder';
import { Box, Col, PAGE_GUTTER } from '../layout';
import { IconArrowUp } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowUp';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
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
  quickIcon?: CentralIcon; quickLabel?: string; onQuick?: () => void;
  hasContent: boolean;
  onStartRec: () => void; onCancelRec: () => void; onStopRec: () => void; onSend: () => void;
}

function ComposerBtn({ icon, label, onPress, fg, hoverFg, chipBg, mr }: {
  icon: CentralIcon; label: string; onPress: () => void; fg: string; hoverFg: string; chipBg: string; mr?: number;
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
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing === true || e.nativeEvent.keyCode === 229) return;
    e.preventDefault();
    if (p.hasContent) p.onSend();
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
        placeholder="Message"
        variant="plain"
        multiline
        autoGrow
        fontSize={fontSize('3xl')}
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
        onChangeText={(text) => { p.setText(text); }}
        onSelectionChange={(range) => { p.setSelection({ start: range.start, end: range.end }); }}
      />
    </Box>
  );
}

function ComposerLeftControls({ p }: { p: EditorProps }): React.ReactElement {
  const { fg, chipBg } = p;
  const showQuick = !p.attachMenuOpen && !!p.quickIcon && !!p.onQuick;
  return (
    <>
      <ComposerBtn
        icon={p.attachMenuOpen ? IconCrossMedium : IconPlusLarge}
        label={p.attachMenuOpen ? 'Close' : 'Attach'}
        onPress={() => { p.setAttachMenuOpen(o => !o); }}
        fg={fg} hoverFg={p.head} chipBg={chipBg}
        mr={showQuick ? -12 : undefined}
      />
      {showQuick && p.quickIcon && p.onQuick
        ? <ComposerBtn icon={p.quickIcon} label={p.quickLabel ?? 'Attach'} onPress={p.onQuick} fg={fg} hoverFg={p.head} chipBg={chipBg} />
        : null}
    </>
  );
}

function ComposerRightAction({ p, primary }: { p: EditorProps; primary: string }): React.ReactElement | null {
  const { dark, bg } = p;
  if (!p.hasContent) return null;
  return (
    <Button size="md" uniform pill dark={dark} tintBg={primary}
      onPress={p.onSend} icon={<Glyph icon={IconArrowUp} size={20} color={bg} />} />
  );
}

export function ComposerEditor(p: EditorProps): React.ReactElement {
  const { primary, border } = usePalette();
  return (
    <Col padding={{ x: PAGE_GUTTER - COMPOSER_ICON_INSET, y: 10 }} background={border} radius="none">
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

export function AttachMenu({
  head, dark, actions, onClose,
}: {
  head: string; dark: boolean;
  actions: [CentralIcon, string, () => void | Promise<void>][];
  onClose: () => void;
}): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 16, paddingHorizontal: PAGE_GUTTER, paddingTop: 12, paddingBottom: PAGE_GUTTER }}
>
      {actions.map(([icon, label, action]) => (
        <Col key={label} align="center" gap={6}>
          <Button
            uniform pill size="xl" color="secondary" variant="solid" dark={dark}
            accessibilityLabel={label}
            iconStart={<Glyph icon={icon} size={24} color={head}/>}
            onPress={() => { onClose(); void action(); }}
          />
          <Text weight="semibold" size="sm" color={head} numberOfLines={1}>{label}</Text>
        </Col>
      ))}
    </ScrollView>
  );
}
