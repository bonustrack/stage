import { useState, type ReactNode } from 'react';
import { useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { DROPDOWN_MENU, DropdownMenuSeparator } from '@stage-labs/kit/react-native/menu';
import { Box, Col, Row, PAGE_GUTTER } from '../layout';
import { CountTag } from '../CountTag';
import { Eyebrow } from '../Eyebrow';
import { FormField } from '../FormField';
import { AnchoredMenu, useAnchoredMenus } from '../AnchoredMenu';
import { useHover } from '../hover';
import { usePalette, withAlpha } from '../../lib/theme';
import {
  hasListEdits, listEdits, pickerAnchorOf, toggleKey, type ListEdits, type PickerAnchor,
} from './SidebarSection.model';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconMagnifyingGlass } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMagnifyingGlass';
import { IconPencil } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPencil';

const PICKER_LIST_MAX_HEIGHT = 320;
const PICKER_ROW_MIN_HEIGHT = 40;

export interface SectionDraft { draft: string[]; toggle: (key: string) => void }

interface DomRect { left: number; right: number; bottom: number; width: number }

function rectOf(event: GestureResponderEvent): DomRect | undefined {
  const target = event.currentTarget as unknown as { getBoundingClientRect?: () => DomRect };
  return target.getBoundingClientRect?.();
}

function HeaderContent({ title, count, tint, editable }: {
  title: string; count?: number; tint?: string; editable: boolean;
}): React.ReactElement {
  const { sub } = usePalette();
  return (
    <>
      <Eyebrow color={tint}>{title.toUpperCase()}</Eyebrow>
      {count === undefined ? null : <CountTag count={count}/>}
      <Box flex={1}/>
      {editable ? <Glyph icon={IconPencil} size={16} color={tint ?? sub}/> : null}
    </>
  );
}

function SectionHeader({ title, count, editLabel, onEdit }: {
  title: string; count?: number; editLabel: string; onEdit?: (event: GestureResponderEvent) => void;
}): React.ReactElement {
  const { link } = usePalette();
  const { hovered, hoverProps } = useHover();
  if (onEdit === undefined) {
    return (
      <Row align="center" gap={8} padding={{ x: PAGE_GUTTER, top: PAGE_GUTTER, bottom: 8 }}>
        <HeaderContent title={title} count={count} editable={false}/>
      </Row>
    );
  }
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={editLabel}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: PAGE_GUTTER, paddingTop: PAGE_GUTTER, paddingBottom: 8, opacity: pressed ? 0.7 : 1,
      })}
>
      <HeaderContent title={title} count={count} tint={hovered ? link : undefined} editable/>
    </Pressable>
  );
}

export function SectionNote({ text }: { text: string }): React.ReactElement {
  return <Box padding={{ x: PAGE_GUTTER, bottom: 8 }}><Text size="md" color="secondary">{text}</Text></Box>;
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
        inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'done' }}/>
      <DropdownMenuSeparator/>
    </>
  );
}

export function PickerList({ children }: { children: ReactNode }): React.ReactElement {
  return <Scroll style={{ maxHeight: PICKER_LIST_MAX_HEIGHT }} keyboardShouldPersistTaps="handled">{children}</Scroll>;
}

export function PickerNote({ text }: { text: string }): React.ReactElement {
  return <Box padding={{ x: DROPDOWN_MENU.itemPadX, y: 10 }}><Text size="md" color="secondary">{text}</Text></Box>;
}

export function PickerRow({ selected, disabled = false, label, onPress, children }: {
  selected: boolean; disabled?: boolean; label: string; onPress: () => void; children: ReactNode;
}): React.ReactElement {
  const { link } = usePalette();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: DROPDOWN_MENU.itemGap, minHeight: PICKER_ROW_MIN_HEIGHT,
        paddingHorizontal: DROPDOWN_MENU.itemPadX, paddingVertical: DROPDOWN_MENU.itemPadY, opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed && !disabled ? withAlpha(link, DROPDOWN_MENU.pressedAlpha)
          : hovered && !disabled ? withAlpha(link, DROPDOWN_MENU.hoverAlpha) : 'transparent',
      })}
>
      <Row flex={1} align="center" gap={10} style={{ minWidth: 0 }}>{children}</Row>
      {selected ? <Glyph icon={IconCheckmark1} size={DROPDOWN_MENU.icon} color={link}/> : <Box width={DROPDOWN_MENU.icon}/>}
    </Pressable>
  );
}

export function SidebarSection({ title, count, editLabel, canEdit, current, onCommit, renderPicker, children }: {
  title: string; count?: number; editLabel: string; canEdit: boolean; current: string[];
  onCommit: (edits: ListEdits) => void; renderPicker: (draft: SectionDraft) => ReactNode; children?: ReactNode;
}): React.ReactElement {
  const viewport = useWindowDimensions();
  const anchored = useAnchoredMenus();
  const [anchor, setAnchor] = useState<PickerAnchor | null>(null);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const start = (event: GestureResponderEvent): void => {
    setAnchor(pickerAnchorOf(rectOf(event), viewport.width, PAGE_GUTTER));
    setOpened([...current]);
    setDraft([...current]);
    setOpen(true);
  };
  const close = (): void => {
    setOpen(false);
    const edits = listEdits(opened, draft);
    if (hasListEdits(edits)) setTimeout(() => { onCommit(edits); }, 0);
  };
  const toggle = (key: string): void => { setDraft(list => toggleKey(list, key)); };
  return (
    <>
      <SectionHeader title={title} count={count} editLabel={editLabel} onEdit={canEdit ? start : undefined}/>
      {children}
      {open ? (
        <AnchoredMenu visible onClose={close} anchor={anchor?.point ?? null}>
          <Col width={anchored && anchor !== null ? anchor.width : undefined}>{renderPicker({ draft, toggle })}</Col>
        </AnchoredMenu>
      ) : null}
    </>
  );
}
