import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconCircleDashed } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleDashed';
import { IconFolder1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFolder1';
import { IconTag } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTag';
import { IconPeopleCircle } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeopleCircle';
import { IconCrossSmall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossSmall';
import { AnchoredMenu, menuPointAbove, useAnchoredMenus } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { Col, PAGE_GUTTER, Row } from '../layout';
import { LabelChip, LABEL_CHIP_ICON_SIZE } from '../LabelChip';
import { FieldPicker, LabelPicker } from '../channel/channel.labels';
import { toggleKey } from '../conversation/SidebarSection.model';
import { peerLabel } from '../conversation/convTitle';
import { usePalette } from '../../lib/theme';
import type { NewChatMetadata as Metadata } from './newChatMetadata.model';

type EditableField = 'category' | 'status' | 'labels';
const ICONS = { category: IconFolder1, status: IconCircleDashed, labels: IconTag };

function MetadataChip({ label, field, icon, onRemove, onEdit }: {
  label: string; field: string; icon: CentralIcon; onRemove: () => void; onEdit?: (point: MenuPoint) => void;
}): React.ReactElement {
  const { border, text } = usePalette();
  const chip = <LabelChip label={label} leading={<Glyph icon={icon} size={LABEL_CHIP_ICON_SIZE} color={text}/>}/>;
  return (
    <Row align="center" background={border} radius="full" style={{ maxWidth: '100%' }}>
      {onEdit ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${field}: ${label}`} onPress={e => { onEdit(menuPointAbove(e)); }}
          style={{ flexShrink: 1 }}>{chip}</Pressable>
      ) : chip}
      <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${field}: ${label}`} onPress={onRemove}
        style={{ paddingRight: 9, paddingVertical: 6 }}>
        <Glyph icon={IconCrossSmall} size={LABEL_CHIP_ICON_SIZE} color={text}/>
      </Pressable>
    </Row>
  );
}

const isEmpty = (value: Metadata): boolean => value.category === null && value.status === null && value.labels.length === 0 && value.assigned.length === 0;

export function NewChatMetadata({ value, onChange }: { value: Metadata; onChange: (next: Metadata) => void }): React.ReactElement | null {
  const anchored = useAnchoredMenus();
  const [editing, setEditing] = useState<{ field: EditableField; anchor: MenuPoint } | null>(null);
  const current = editing === null || editing.field === 'labels' ? value.labels : [value[editing.field] ?? ''].filter(Boolean);
  const toggle = (key: string): void => {
    if (editing === null) return;
    const field = editing.field;
    const picked = toggleKey(current, key, field !== 'labels');
    onChange({ ...value, [field]: field === 'labels' ? picked : picked[0] ?? null });
    if (field !== 'labels' || picked.length === 0) setEditing(null);
  };
  if (isEmpty(value)) return null;
  return (
    <>
      <Row wrap gap={8} padding={{ x: PAGE_GUTTER, top: 12, bottom: 4 }}>
        {(['category', 'status'] as const).map(field => value[field] === null ? null : (
          <MetadataChip key={field} field={field} label={value[field]} icon={ICONS[field]}
            onEdit={anchor => { setEditing({ field, anchor }); }} onRemove={() => { onChange({ ...value, [field]: null }); }}/>
        ))}
        {value.labels.map(label => (
          <MetadataChip key={label} field="label" label={label} icon={ICONS.labels}
            onEdit={anchor => { setEditing({ field: 'labels', anchor }); }}
            onRemove={() => { onChange({ ...value, labels: value.labels.filter(item => item !== label) }); }}/>
        ))}
        {value.assigned.map(address => (
          <MetadataChip key={address} field="assignee" label={peerLabel(address)} icon={IconPeopleCircle}
            onRemove={() => { onChange({ ...value, assigned: value.assigned.filter(item => item !== address) }); }}/>
        ))}
      </Row>
      {editing === null ? null : (
        <AnchoredMenu visible anchor={editing.anchor} onClose={() => { setEditing(null); }}>
          <Col width={anchored ? 300 : undefined}>
            {editing.field === 'labels' ? <LabelPicker draft={current} current={current} toggle={toggle}/>
              : <FieldPicker field={editing.field} draft={current} toggle={toggle}/>}
          </Col>
        </AnchoredMenu>
      )}
    </>
  );
}
