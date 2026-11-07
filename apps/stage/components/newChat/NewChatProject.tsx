import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { CHANNEL_FIELD_NOUNS } from '@stage-labs/client/xmtp/channelMeta';
import { IconChevronDownSmall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronDownSmall';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';
import { AnchoredMenu, PICKER_WIDTH, menuPointAbove } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { MenuRow } from '../MenuRows';
import { useKnownFieldValues } from '../home/listing';
import { FIELD_SECTIONS } from '../channel/channel.labels';
import { PickerList, PickerNote, PickerSearch } from '../PickerRows';
import { tagSearch } from '../channel/SidebarSection.model';
import { includesKey } from '@stage-labs/client/collections';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import { Column, PAGE_GUTTER, Row } from '../layout';

const TITLE = FIELD_SECTIONS.category.title;
const NOUN = CHANNEL_FIELD_NOUNS.category;
const BUTTON_HEIGHT = 38;
const TEXT_INSET = 10;
const VALUE_MAX_WIDTH = 150;
const NO_SHRINK = { flexShrink: 0 } as const;

function ProjectButton({ value, onPress }: { value: string | null; onPress: (point: MenuPoint) => void }): React.ReactElement {
  const { text, sub, link } = usePalette();
  const { hovered, hoverProps } = useHover();
  const color = hovered ? link : value === null ? sub : text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value === null ? TITLE : `${TITLE}: ${value}`}
      onPress={(e) => {
        onPress(menuPointAbove(e));
      }}
      {...hoverProps}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: BUTTON_HEIGHT,
        paddingHorizontal: TEXT_INSET,
        borderRadius: 999,
        backgroundColor: 'transparent',
        flexShrink: 1,
        minWidth: 0,
      }}
    >
      <Text size="md" color={color} truncate style={{ maxWidth: VALUE_MAX_WIDTH, flexShrink: 1, minWidth: 0 }}>
        {value ?? TITLE}
      </Text>
      <Column style={NO_SHRINK}>
        <Glyph icon={IconChevronDownSmall} size={16} color={color} />
      </Column>
    </Pressable>
  );
}

function ProjectMenu({ value, pick }: { value: string | null; pick: (next: string | null) => void }): React.ReactElement {
  const projects = useKnownFieldValues('chats').categories;
  const [query, setQuery] = useState('');
  const current = value === null ? [] : [value];
  const { shown, typed, creatable } = tagSearch(query, projects, current);
  const create = (): void => {
    if (creatable) pick(typed);
  };
  return (
    <>
      <PickerSearch value={query} onChangeText={setQuery} placeholder="Search or create" onSubmit={create} />
      <PickerList>
        {shown.map((project) => {
          const selected = includesKey(current, project);
          return (
            <MenuRow
              key={project.toLowerCase()}
              label={project}
              selected={selected}
              onPress={() => {
                pick(selected ? null : project);
              }}
            />
          );
        })}
        {creatable ? <MenuRow icon={IconPlusLarge} label={`Create "${typed}"`} onPress={create} /> : null}
        {shown.length === 0 && !creatable ? <PickerNote text={`Type to create a ${NOUN}.`} /> : null}
      </PickerList>
      {value === null ? null : (
        <MenuRow
          divider
          icon={IconCrossMedium}
          label={`Clear ${NOUN}`}
          onPress={() => {
            pick(null);
          }}
        />
      )}
    </>
  );
}

export function NewChatProject({
  value,
  onChange,
  flush,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  flush?: boolean;
}): React.ReactElement {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const pick = (next: string | null): void => {
    onChange(next);
    setAnchor(null);
  };
  return (
    <>
      <Row padding={{ left: flush === true ? 0 : PAGE_GUTTER - TEXT_INSET }}>
        <ProjectButton value={value} onPress={setAnchor} />
      </Row>
      {anchor === null ? null : (
        <AnchoredMenu
          visible
          anchor={anchor}
          onClose={() => {
            setAnchor(null);
          }}
          avoidKeyboard
          width={PICKER_WIDTH}
        >
          <ProjectMenu value={value} pick={pick} />
        </AnchoredMenu>
      )}
    </>
  );
}
