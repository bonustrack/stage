import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { IconTag } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTag';
import { IconPeopleCircle } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeopleCircle';
import { IconCrossSmall } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossSmall';
import { AnchoredMenu, menuPointAbove, useAnchoredMenus } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { Col, PAGE_GUTTER, Row } from '../layout';
import { LabelChip, LABEL_CHIP_ICON_SIZE } from '../LabelChip';
import { FIELD_SECTIONS, LabelPicker } from '../channel/channel.labels';
import { toggleKey } from '../conversation/SidebarSection.model';
import { peerLabel } from '../conversation/convTitle';
import { usePalette } from '../../lib/theme';
import type { NewChatMetadata as Metadata } from './newChatMetadata.model';

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

const isEmpty = (value: Metadata): boolean => value.status === null && value.labels.length === 0 && value.assigned.length === 0;

export function NewChatMetadata({ value, onChange }: { value: Metadata; onChange: (next: Metadata) => void }): React.ReactElement | null {
  const anchored = useAnchoredMenus();
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const toggle = (key: string): void => {
    const labels = toggleKey(value.labels, key);
    onChange({ ...value, labels });
    if (labels.length === 0) setAnchor(null);
  };
  if (isEmpty(value)) return null;
  return (
    <>
      <Row wrap gap={8} padding={{ x: PAGE_GUTTER, top: 12, bottom: 4 }}>
        {value.status === null ? null : (
          <MetadataChip field="status" label={value.status} icon={FIELD_SECTIONS.status.icon} onRemove={() => { onChange({ ...value, status: null }); }}/>
        )}
        {value.labels.map(label => (
          <MetadataChip key={label} field="label" label={label} icon={IconTag} onEdit={setAnchor}
            onRemove={() => { onChange({ ...value, labels: value.labels.filter(item => item !== label) }); }}/>
        ))}
        {value.assigned.map(address => (
          <MetadataChip key={address} field="assignee" label={peerLabel(address)} icon={IconPeopleCircle}
            onRemove={() => { onChange({ ...value, assigned: value.assigned.filter(item => item !== address) }); }}/>
        ))}
      </Row>
      {anchor === null ? null : (
        <AnchoredMenu visible anchor={anchor} onClose={() => { setAnchor(null); }}>
          <Col width={anchored ? 300 : undefined}><LabelPicker draft={value.labels} current={value.labels} toggle={toggle}/></Col>
        </AnchoredMenu>
      )}
    </>
  );
}
