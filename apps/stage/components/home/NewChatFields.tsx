import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconChevronDownSmall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronDownSmall';
import { IconCircleDashed } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleDashed';
import { IconFolder1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFolder1';
import { AnchoredMenu, menuPointAbove, useAnchoredMenus } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { Box, Col, Row } from '../layout';
import { FieldPicker } from '../channel/channel.labels';
import { toggleKey } from '../conversation/SidebarSection.model';
import { useHover } from '../hover';
import { usePalette } from '../../lib/theme';
import type { NewChatField, NewChatFields as Fields } from './newChatMetadata.model';

const FIELDS: readonly { id: NewChatField; title: string; icon: CentralIcon }[] = [
  { id: 'category', title: 'Project', icon: IconFolder1 },
  { id: 'status', title: 'Status', icon: IconCircleDashed },
];
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
  const toggle = (key: string): void => {
    if (editing === null) return;
    onChange(editing.field, toggleKey(draft, key, true)[0] ?? null);
    setEditing(null);
  };
  return (
    <>
      <Row align="center" minWidth={0} style={{ flexShrink: 1 }}>
        {FIELDS.map(field => (
          <FieldButton key={field.id} title={field.title} icon={field.icon} value={value[field.id]}
            onPress={anchor => { setEditing({ field: field.id, anchor }); }}/>
        ))}
      </Row>
      {editing === null ? null : (
        <AnchoredMenu visible anchor={editing.anchor} onClose={() => { setEditing(null); }}>
          <Col width={anchored ? 300 : undefined}><FieldPicker field={editing.field} draft={draft} toggle={toggle}/></Col>
        </AnchoredMenu>
      )}
    </>
  );
}
