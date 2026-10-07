import { Text } from '@stage-labs/kit/react-native/text';
import { shortAddress } from '@stage-labs/client/identity/format';
import { Avatar } from './Avatar';
import { Row } from './layout';
import { AppIcon } from './widgets';
import { memberListEntries } from './conversation/MemberListSidebar.model';
import { visibleChannelFields, type ChannelRowFieldData } from './ChannelRowFields.model';
import type { ChannelFields } from './home/fields.model';
import { getPeerName, usePeerProfiles } from '../lib/peerProfiles';

const MAX_PEOPLE = 3;

function FieldPeople({ addresses, label }: { addresses: string[]; label: string }): React.ReactElement {
  usePeerProfiles(addresses.slice(0, MAX_PEOPLE));
  const entries = memberListEntries(addresses, getPeerName, shortAddress);
  const shown = entries.slice(0, MAX_PEOPLE);
  const overflow = entries.length - shown.length;
  return (
    <Row align="center" gap={3} accessible accessibilityLabel={`${label}: ${entries.map(entry => entry.name).join(', ')}`}>
      {shown.map(entry => <Avatar key={entry.address} address={entry.address} size={20}/>)}
      {overflow > 0 ? <Text size="2xs" color="secondary">+{overflow}</Text> : null}
    </Row>
  );
}

export function ChannelRowFields({ data, fields }: {
  data: ChannelRowFieldData; fields: ChannelFields;
}): React.ReactElement | null {
  const visible = visibleChannelFields(data, fields);
  if (visible.length === 0) return null;
  return (
    <Row wrap align="center" gap={8} padding={{ top: 6 }}>
      {visible.map(field => (
        <Row key={field.id} align="center" gap={4} minWidth={0} style={{ flexShrink: 1 }}>
          {field.icon === undefined ? null : <AppIcon name={field.icon} size={14} color="secondary"/>}
          {field.addresses.length > 0 ? <FieldPeople addresses={field.addresses} label={field.label}/> : (
            <Text size="2xs" color="secondary" truncate style={{ flexShrink: 1 }} accessibilityLabel={`${field.label}: ${field.value}`}>{field.value}</Text>
          )}
        </Row>
      ))}
    </Row>
  );
}
