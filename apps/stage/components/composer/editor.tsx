import { useState } from 'react';
import { Platform, type GestureResponderEvent, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import { fontName, fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { TextField } from '@stage-labs/kit/react-native/text-field';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Button } from '@stage-labs/kit/react-native/button';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { VoiceRecorder } from '@stage-labs/kit/react-native/voice-recorder';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconMicrophone } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophone';
import { dictationLabel, type DictationPhase } from './dictation.model';
import type { makeDictationPress } from './dictation.press';
import { AnchoredMenu, menuPointAbove } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuRow } from '../MenuRows';
import { IconArrowUp } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowUp';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import type { AttachAction } from './attachActions';
import { usePalette } from '../../lib/theme';
import { MESSAGE_BODY } from '../bubble/MessageText';
import { useHover } from '../hover';
import { HoverTooltip } from '../HoverTooltip';
import { Column, PAGE_GUTTER, SCROLLBAR_ON_HOVER, SELF_SCROLLBAR } from '../layout';

const COMPOSER_ICON_INSET = 7;

interface EditorTextProps {
  dark: boolean;
  fg: string;
  head: string;
  bg: string;
  sub: string;
  chipBg: string;
  text: string;
  setText: (v: string) => void;
  selection: { start: number; end: number };
  setSelection: (s: { start: number; end: number }) => void;
  focusNonce?: number;
  blurNonce?: number;
  hasContent: boolean;
  busy?: boolean;
  placeholder?: string;
  rounded?: boolean;
  onMentionKey?: (key: string, shift: boolean) => boolean;
  onSend: () => void;
}

interface EditorMediaProps {
  recording: boolean;
  levels: number[];
  recordSecs: number;
  attachMenuOpen: boolean;
  setAttachMenuOpen: (fn: (o: boolean) => boolean) => void;
  attachActions?: AttachAction[];
  quick?: AttachAction;
  dictation?: { phase: DictationPhase; press: ReturnType<typeof makeDictationPress> };
  onStartRec: () => void;
  onCancelRec: () => void;
  onStopRec: () => void;
}

type EditorProps = EditorTextProps & EditorMediaProps;

type ComposerEditorProps = EditorTextProps & ((EditorMediaProps & { textOnly?: undefined }) | { textOnly: { onUnavailable: () => void } });

function textOnlyMedia(onUnavailable: () => void): EditorMediaProps {
  return {
    recording: false,
    levels: [],
    recordSecs: 0,
    attachMenuOpen: false,
    setAttachMenuOpen: onUnavailable,
    onStartRec: onUnavailable,
    onCancelRec: onUnavailable,
    onStopRec: onUnavailable,
  };
}

function ComposerBtn({
  icon,
  label,
  onPress,
  fg,
  hoverFg,
  chipBg,
  mr,
}: {
  icon: CentralIcon;
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  fg: string;
  hoverFg: string;
  chipBg: string;
  mr?: number;
}): React.ReactElement {
  const { hovered, hoverProps } = useHover();
  return (
    <HoverTooltip label={label}>
      <Pressable
        accessibilityLabel={label}
        onPress={onPress}
        {...hoverProps}
        style={({ pressed }) => ({
          width: 38,
          height: 38,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? chipBg : 'transparent',
          marginRight: mr,
        })}
      >
        <Glyph icon={icon} size={24} color={hovered ? hoverFg : fg} />
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

function makeWebEnterToSend(p: EditorProps): ((event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void) | undefined {
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
    <Column style={{ position: 'relative' }}>
      <TextField
        name="composer"
        value={p.text}
        onKeyPress={makeWebEnterToSend(p)}
        placeholder={p.placeholder ?? 'Message'}
        appearance="plain"
        variant="longText"
        autoGrow
        fontSize={fontSize(MESSAGE_BODY.size)}
        fontFamily={fontName.sans}
        color={p.head}
        placeholderColor={p.sub}
        paddingX={8}
        paddingTop={4}
        paddingBottom={8}
        lineHeight={MESSAGE_BODY.lineHeight}
        minHeight={24}
        maxHeight={210}
        autoCapitalize="sentences"
        focusNonce={p.focusNonce ?? 0}
        blurNonce={p.blurNonce ?? 0}
        selection={p.selection}
        dark={dark}
        disabled={p.busy}
        dataSet={SELF_SCROLLBAR.dataSet}
        onChangeText={p.setText}
        onSelectionChange={(range) => {
          p.setSelection({ start: range.start, end: range.end });
        }}
      />
    </Column>
  );
}

function ComposerLeftControls({ p }: { p: EditorProps }): React.ReactElement {
  const { fg, chipBg, quick } = p;
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const close = (): void => {
    p.setAttachMenuOpen(() => false);
  };
  return (
    <>
      <ComposerBtn
        icon={IconPlusLarge}
        label="Attach"
        onPress={(e) => {
          setAnchor(menuPointAbove(e));
          p.setAttachMenuOpen(() => true);
        }}
        fg={fg}
        hoverFg={p.head}
        chipBg={chipBg}
        mr={quick ? -12 : undefined}
      />
      {quick ? (
        <ComposerBtn icon={quick.icon} label={quick.label} onPress={() => void quick.run()} fg={fg} hoverFg={p.head} chipBg={chipBg} />
      ) : null}
      <AnchoredMenu visible={p.attachMenuOpen} onClose={close} anchor={anchor}>
        {(p.attachActions ?? []).map((action) => (
          <MenuRow
            key={action.id}
            icon={action.icon}
            label={action.label}
            onPress={() => {
              close();
              void action.run();
            }}
          />
        ))}
      </AnchoredMenu>
    </>
  );
}

function ComposerRightAction({ p, primary }: { p: EditorProps; primary: string }): React.ReactElement | null {
  const { dark, bg } = p;
  if (!p.hasContent) return null;
  return (
    <Button
      variant="primary"
      size="md"
      uniform
      pill
      dark={dark}
      tintBg={primary}
      loading={p.busy}
      disabled={p.dictation !== undefined && p.dictation.phase !== 'idle'}
      onPress={p.onSend}
      icon={<Glyph icon={IconArrowUp} size={20} color={bg} />}
    />
  );
}

function ComposerMic({ p, recorder }: { p: EditorProps; recorder: React.ReactElement }): React.ReactElement {
  if (p.recording || !p.dictation) return <HoverTooltip label="Record voice message">{recorder}</HoverTooltip>;
  const active = p.dictation.phase !== 'idle';
  const label = active ? 'Stop dictation' : 'Dictate message';
  return (
    <HoverTooltip label={label}>
      <Button
        size="md"
        uniform
        pill
        dark={p.dark}
        variant={active ? 'solid' : 'ghost'}
        accessibilityLabel={label}
        accessibilityState={{ disabled: p.busy === true, selected: active }}
        accessibilityHint="Tap to start or stop. Hold on the mic to dictate. Release or slide off to stop."
        disabled={p.busy}
        onPress={(event) => {
          p.dictation?.press.press(event.nativeEvent.identifier !== undefined);
        }}
        onPressIn={(event) => {
          p.dictation?.press.pressIn(event.nativeEvent.identifier !== undefined);
        }}
        onLongPress={p.dictation.press.hold}
        onPressOut={p.dictation.press.pressOut}
        onTouchEnd={p.dictation.press.release}
        onTouchCancel={p.dictation.press.cancel}
        delayLongPress={350}
        tintBg={active ? p.head : 'transparent'}
        icon={<Glyph icon={IconMicrophone} size={22} color={active ? p.bg : p.fg} />}
      />
    </HoverTooltip>
  );
}

export function composerRadius(rounded: boolean | undefined): 'sm' | 'none' {
  return rounded === true ? 'sm' : 'none';
}

export function ComposerEditor(props: ComposerEditorProps): React.ReactElement {
  const p: EditorProps = props.textOnly ? { ...props, ...textOnlyMedia(props.textOnly.onUnavailable) } : props;
  const { primary, border } = usePalette();
  return (
    <Column
      {...SCROLLBAR_ON_HOVER}
      padding={{ x: PAGE_GUTTER - COMPOSER_ICON_INSET, y: 10 }}
      background={border}
      radius={composerRadius(p.rounded)}
    >
      {p.dictation && p.dictation.phase !== 'idle' ? (
        <Text size="3xs" color={p.sub} accessibilityLiveRegion="polite" style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
          {dictationLabel(p.dictation.phase)}
        </Text>
      ) : null}
      <VoiceRecorder
        recording={p.recording}
        levels={p.levels}
        recordSecs={p.recordSecs}
        fg={p.fg}
        head={p.head}
        sub={p.sub}
        bg={p.bg}
        chipBg={p.chipBg}
        primary={primary}
        dark={p.dark}
        inputSlot={<ComposerInputSlot p={p} />}
        leftControls={<ComposerLeftControls p={p} />}
        rightAction={<ComposerRightAction p={p} primary={primary} />}
        wrapMic={(mic) => <ComposerMic p={p} recorder={mic} />}
        onStart={p.onStartRec}
        onCancel={p.onCancelRec}
        onComplete={p.onStopRec}
      />
    </Column>
  );
}
