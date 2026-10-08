import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { CHANNEL_FIELD_NOUNS } from '@stage-labs/client/xmtp/labels';
import { IconChevronDownSmall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronDownSmall';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { AnchoredMenu, menuPointAbove, useAnchoredMenus } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { Box, Col, Row } from '../layout';
import { MenuRow } from '../MenuRows';
import { FIELD_SECTIONS, FieldPicker } from '../channel/channel.labels';
import { toggleKey } from '../conversation/SidebarSection.model';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import type { NewChatField, NewChatFields as Fields } from './newChatMetadata.model';

const FIELDS: readonly NewChatField[] = ['category', 'status'];
const BUTTON_HEIGHT = 38;
const VALUE_MAX_WIDTH = 150;
const NO_SHRINK = { flexShrink: 0 } as const;

function FieldButton({ title, icon, value, onPress }: {
  title: string; icon: CentralIcon; value: string | null; onPress: (point: MenuPoint) => void;
}): React.ReactElement {
  const { text, sub, link, border } = usePalette();
  const { hovered, hoverProps } = useHover();
  const color = hovered ? link : value === null ? sub : text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value === null ? title : `${title}: ${value}`}
      onPress={e => { onPress(menuPointAbove(e)); }} {...hoverProps}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 4, height: BUTTON_HEIGHT, paddingHorizontal: 10, borderRadius: 999,
        backgroundColor: pressed ? border : 'transparent', flexShrink: 1, minWidth: 0,
      })}>
      {value === null ? null : <Box style={NO_SHRINK}><Glyph icon={icon} size={16} color={color}/></Box>}
      <Text size="sm" color={color} truncate style={{ maxWidth: VALUE_MAX_WIDTH, flexShrink: 1, minWidth: 0 }}>{value ?? title}</Text>
      <Box style={NO_SHRINK}><Glyph icon={IconChevronDownSmall} size={16} color={color}/></Box>
    </Pressable>
  );
}

export function NewChatFields({ value, onChange }: {
  value: Fields; onChange: (field: NewChatField, next: string | null) => void;
}): React.ReactElement {
  const anchored = useAnchoredMenus();
  const [editing, setEditing] = useState<{ field: NewChatField; anchor: MenuPoint } | null>(null);
  const draft = editing === null ? [] : [value[editing.field]].filter((item): item is string => item !== null);
  const pick = (next: string | null): void => {
    if (editing === null) return;
    onChange(editing.field, next);
    setEditing(null);
  };
  return (
    <>
      <Row align="center" minWidth={0} style={{ flexShrink: 1 }}>
        {FIELDS.map(field => (
          <FieldButton key={field} title={FIELD_SECTIONS[field].title} icon={FIELD_SECTIONS[field].icon} value={value[field]}
            onPress={anchor => { setEditing({ field, anchor }); }}/>
        ))}
      </Row>
      {editing === null ? null : (
        <AnchoredMenu visible anchor={editing.anchor} onClose={() => { setEditing(null); }} avoidKeyboard>
          <Col width={anchored ? 300 : undefined}>
            <FieldPicker field={editing.field} draft={draft} toggle={key => { pick(toggleKey(draft, key, true)[0] ?? null); }}/>
            {draft.length === 0 ? null : (
              <MenuRow divider icon={IconCrossMedium} label={`Clear ${CHANNEL_FIELD_NOUNS[editing.field]}`} onPress={() => { pick(null); }}/>
            )}
          </Col>
        </AnchoredMenu>
      )}
    </>
  );
}
