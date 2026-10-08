import { useState, type ReactNode } from 'react';
import { Platform, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { SEARCH_INPUT_PROPS } from '@stage-labs/kit/react-native/input';
import { DROPDOWN_MENU, DropdownMenuSeparator, useDropdownMenuText } from '@stage-labs/kit/react-native/menu';
import { Box, Col, Row, PAGE_GUTTER } from '../layout';
import { CountTag } from '../CountTag';
import { Eyebrow } from '../Eyebrow';
import { FormField } from '../FormField';
import { AnchoredMenu, anchorRect, useAnchoredMenus } from '../AnchoredMenu';
import { useHover } from '../hover';
import { usePalette, withAlpha } from '../../lib/theme';
import { isCoarsePointer } from '../../lib/webLayout';
import {
  hasListEdits, listEdits, pickerAnchorOf, pickerWidth, toggleKey, type ListEdits, type PickerAnchor,
} from './SidebarSection.model';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { IconPencil } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPencil';

const PICKER_LIST_MAX_HEIGHT = 320;
const PICKER_ROW_MIN_HEIGHT = 40;
const TITLE_SIZE = '2xs';
const TITLE_ICON_SIZE = 15;

export interface SectionDraft { draft: string[]; toggle: (key: string) => void }

function HeaderContent({ title, icon, count, tint, pen }: {
  title: string; icon: CentralIcon; count?: number; tint?: string; pen: 'none' | 'hidden' | 'shown';
}): React.ReactElement {
  const { sub } = usePalette();
  return (
    <>
      <Glyph icon={icon} size={TITLE_ICON_SIZE} color={tint ?? sub}/>
      <Eyebrow size={TITLE_SIZE} color={tint}>{title.toUpperCase()}</Eyebrow>
      {count === undefined ? null : <CountTag count={count}/>}
      <Box flex={1}/>
      {pen === 'none' ? null : <Box style={{ opacity: pen === 'shown' ? 1 : 0 }}><Glyph icon={IconPencil} size={16} color={tint ?? sub}/></Box>}
    </>
  );
}

function SectionHeader({ title, icon, count, editLabel, penShown, onEdit, onFocusChange }: {
  title: string; icon: CentralIcon; count?: number; editLabel: string; penShown: boolean;
  onEdit?: (event: GestureResponderEvent) => void; onFocusChange: (focused: boolean) => void;
}): React.ReactElement {
  const { link } = usePalette();
  const { hovered, hoverProps } = useHover();
  if (onEdit === undefined) {
    return (
      <Row align="center" gap={8} padding={{ x: PAGE_GUTTER, top: PAGE_GUTTER, bottom: 8 }}>
        <HeaderContent title={title} icon={icon} count={count} pen="none"/>
      </Row>
    );
  }
  return (
    <Pressable
      onPress={onEdit}
      onFocus={() => { onFocusChange(true); }}
      onBlur={() => { onFocusChange(false); }}
      accessibilityRole="button"
      accessibilityLabel={editLabel}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: PAGE_GUTTER, paddingTop: PAGE_GUTTER, paddingBottom: 8, opacity: pressed ? 0.7 : 1,
      })}
>
      <HeaderContent title={title} icon={icon} count={count} tint={hovered ? link : undefined} pen={penShown ? 'shown' : 'hidden'}/>
    </Pressable>
  );
}

export function SectionNote({ text }: { text: string }): React.ReactElement {
  return <Box padding={{ x: PAGE_GUTTER, bottom: 8 }}><Text size="xs" color="secondary">{text}</Text></Box>;
}

export function PickerSearch({ value, onChangeText, placeholder, onSubmit }: {
  value: string; onChangeText: (text: string) => void; placeholder: string; onSubmit?: () => void;
}): React.ReactElement {
  const { sub } = usePalette();
  const anchored = useAnchoredMenus();
  return (
    <>
      <FormField value={value} onChangeText={onChangeText} placeholder={placeholder} autoFocus={anchored}
        onSubmit={onSubmit === undefined ? undefined : () => { onSubmit(); }}
        leading={<Glyph icon={IconMagnifyingGlass} size={18} color={sub}/>}
        inputProps={{ ...SEARCH_INPUT_PROPS, autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'done' }}/>
      <DropdownMenuSeparator/>
    </>
  );
}

export function PickerList({ children }: { children: ReactNode }): React.ReactElement {
  return <Scroll style={{ maxHeight: PICKER_LIST_MAX_HEIGHT }} keyboardShouldPersistTaps="handled">{children}</Scroll>;
}

export function PickerNote({ text }: { text: string }): React.ReactElement {
  return <Box padding={{ x: DROPDOWN_MENU.itemPadX, y: 10 }}><Text size="xs" color="secondary">{text}</Text></Box>;
}

function checkboxKeys(onPress: () => void, disabled: boolean) {
  if (Platform.OS !== 'web') return {};
  return {
    onKeyDown: (event: Pick<KeyboardEvent, 'key' | 'repeat' | 'preventDefault'>): void => {
      if (disabled || (event.key !== ' ' && event.key !== 'Spacebar')) return;
      event.preventDefault();
      if (!event.repeat) onPress();
    },
  };
}

export function PickerRow({ selected, disabled = false, label, text = label, count, onPress, leading, children }: {
  selected: boolean; disabled?: boolean; label: string; text?: string; count?: number; onPress: () => void; leading?: ReactNode; children?: ReactNode;
}): React.ReactElement {
  const { link } = usePalette();
  const { hovered, hoverProps } = useHover();
  const menuText = useDropdownMenuText();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      accessibilityLabel={count === undefined ? label : `${label} (${count})`}
      {...checkboxKeys(onPress, disabled)}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: DROPDOWN_MENU.itemGap, minHeight: PICKER_ROW_MIN_HEIGHT,
        paddingHorizontal: DROPDOWN_MENU.itemPadX, paddingVertical: DROPDOWN_MENU.itemPadY, opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed && !disabled ? withAlpha(link, DROPDOWN_MENU.pressedAlpha)
          : hovered && !disabled ? withAlpha(link, DROPDOWN_MENU.hoverAlpha) : 'transparent',
      })}
>
      {leading}
      <Box flex={1} style={{ minWidth: 0 }}>{children ?? <Row align="center" gap={DROPDOWN_MENU.itemGap}>
        <Box style={{ flexShrink: 1, minWidth: 0 }}><Text {...menuText} truncate>{text}</Text></Box>
        {count === undefined ? null : <CountTag count={count}/>}
      </Row>}</Box>
      {selected ? <Glyph icon={IconCheckmark1} size={DROPDOWN_MENU.icon} color={link}/> : <Box width={DROPDOWN_MENU.icon}/>}
    </Pressable>
  );
}

export function SidebarSection({ title, icon, count, editLabel, canEdit, current, single, onCommit, renderPicker, children }: {
  title: string; icon: CentralIcon; count?: number; editLabel: string; canEdit: boolean; current: string[]; single?: boolean;
  onCommit: (edits: ListEdits) => void; renderPicker: (draft: SectionDraft) => ReactNode; children?: ReactNode;
}): React.ReactElement {
  const viewport = useWindowDimensions();
  const anchored = useAnchoredMenus();
  const [anchor, setAnchor] = useState<PickerAnchor | null>(null);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [opened, setOpened] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const start = (event: GestureResponderEvent): void => {
    setAnchor(pickerAnchorOf(anchorRect(event), viewport.width, PAGE_GUTTER));
    setOpened([...current]);
    setDraft([...current]);
    setOpen(true);
  };
  const finish = (next: string[]): void => {
    setOpen(false);
    const edits = listEdits(opened, next);
    if (hasListEdits(edits)) setTimeout(() => { onCommit(edits); }, 0);
  };
  const close = (): void => { finish(draft); };
  const toggle = (key: string): void => {
    if (single === true) finish(toggleKey(draft, key, true));
    else setDraft(list => toggleKey(list, key));
  };
  const penShown = open || hovered || focused || isCoarsePointer();
  return (
    <Box onPointerEnter={() => { setHovered(true); }} onPointerLeave={() => { setHovered(false); }}>
      <SectionHeader title={title} icon={icon} count={count} editLabel={editLabel} penShown={penShown}
        onEdit={canEdit ? start : undefined} onFocusChange={setFocused}/>
      {children}
      {open ? (
        <AnchoredMenu visible onClose={close} anchor={anchor?.point ?? null}>
          <Col width={pickerWidth(anchored, anchor)}>{renderPicker({ draft, toggle })}</Col>
        </AnchoredMenu>
      ) : null}
    </Box>
  );
}
