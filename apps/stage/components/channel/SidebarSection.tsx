import { useState, type ReactNode } from 'react';
import { useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { CountTag } from '../CountTag';
import { Eyebrow } from '../Eyebrow';
import { AnchoredMenu, anchorRect, useAnchoredMenus } from '../AnchoredMenu';
import { HoverTint, hoverRevealed, useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { hasListEdits, listEdits, pickerAnchorOf, pickerWidth, type ListEdits, type PickerAnchor } from './SidebarSection.model';
import { toggleKey } from '@stage-labs/client/collections';
import { IconPencil } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPencil';
import { Column, Row, PAGE_GUTTER } from '../layout';

const TITLE_SIZE = '2xs';
const TITLE_ICON_SIZE = 15;

export interface SectionDraft {
  draft: string[];
  toggle: (key: string) => void;
}

function HeaderContent({
  title,
  icon,
  count,
  tint,
  pen,
}: {
  title: string;
  icon: CentralIcon;
  count?: number;
  tint?: string;
  pen: 'none' | 'hidden' | 'shown';
}): React.ReactElement {
  const { sub } = usePalette();
  return (
    <>
      <Glyph icon={icon} size={TITLE_ICON_SIZE} color={tint ?? sub} />
      <Eyebrow size={TITLE_SIZE} color={tint}>
        {title.toUpperCase()}
      </Eyebrow>
      {count === undefined ? null : <CountTag count={count} />}
      <Column weight={1} />
      {pen === 'none' ? null : (
        <Column style={{ opacity: pen === 'shown' ? 1 : 0 }}>
          <Glyph icon={IconPencil} size={16} color={tint ?? sub} />
        </Column>
      )}
    </>
  );
}

function SectionHeader({
  title,
  icon,
  count,
  editLabel,
  penShown,
  onEdit,
  onFocusChange,
}: {
  title: string;
  icon: CentralIcon;
  count?: number;
  editLabel: string;
  penShown: boolean;
  onEdit?: (event: GestureResponderEvent) => void;
  onFocusChange: (focused: boolean) => void;
}): React.ReactElement {
  const { link } = usePalette();
  const { hovered, hoverProps } = useHover();
  if (onEdit === undefined) {
    return (
      <Row align="center" gap={8} padding={{ x: PAGE_GUTTER, top: PAGE_GUTTER, bottom: 8 }}>
        <HeaderContent title={title} icon={icon} count={count} pen="none" />
      </Row>
    );
  }
  return (
    <Pressable
      onPress={onEdit}
      onFocus={() => {
        onFocusChange(true);
      }}
      onBlur={() => {
        onFocusChange(false);
      }}
      accessibilityRole="button"
      accessibilityLabel={editLabel}
      {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: PAGE_GUTTER,
        paddingTop: PAGE_GUTTER,
        paddingBottom: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <HeaderContent title={title} icon={icon} count={count} tint={hovered ? link : undefined} pen={penShown ? 'shown' : 'hidden'} />
    </Pressable>
  );
}

export function SectionNote({ text }: { text: string }): React.ReactElement {
  return (
    <Column padding={{ x: PAGE_GUTTER, bottom: 8 }}>
      <Text size="xs" color="secondary">
        {text}
      </Text>
    </Column>
  );
}

export function SidebarSection({
  title,
  icon,
  count,
  editLabel,
  canEdit,
  current,
  single,
  onCommit,
  renderPicker,
  children,
}: {
  title: string;
  icon: CentralIcon;
  count?: number;
  editLabel: string;
  canEdit: boolean;
  current: string[];
  single?: boolean;
  onCommit: (edits: ListEdits) => void;
  renderPicker: (draft: SectionDraft) => ReactNode;
  children?: ReactNode;
}): React.ReactElement {
  const viewport = useWindowDimensions();
  const anchored = useAnchoredMenus();
  const [anchor, setAnchor] = useState<PickerAnchor | null>(null);
  const [open, setOpen] = useState(false);
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
    if (hasListEdits(edits))
      setTimeout(() => {
        onCommit(edits);
      }, 0);
  };
  const close = (): void => {
    finish(draft);
  };
  const toggle = (key: string): void => {
    if (single === true) finish(toggleKey(draft, key, true));
    else setDraft((list) => toggleKey(list, key));
  };
  return (
    <HoverTint>
      {(hovered) => (
        <>
          <SectionHeader
            title={title}
            icon={icon}
            count={count}
            editLabel={editLabel}
            penShown={open || focused || hoverRevealed(hovered)}
            onEdit={canEdit ? start : undefined}
            onFocusChange={setFocused}
          />
          {children}
          {open ? (
            <AnchoredMenu visible onClose={close} anchor={anchor?.point ?? null}>
              <Column width={pickerWidth(anchored, anchor)}>{renderPicker({ draft, toggle })}</Column>
            </AnchoredMenu>
          ) : null}
        </>
      )}
    </HoverTint>
  );
}
