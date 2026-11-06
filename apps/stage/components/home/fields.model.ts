import type { AppIconName } from '../appIcons';
import type { ChannelField, ChannelFields } from '../../lib/channelFields.model';
import { GROUPING_FIELDS } from '../../lib/grouping.model';

const { category, status, priority } = GROUPING_FIELDS;

export const CHANNEL_FIELDS: readonly { id: ChannelField; label: string; icon?: AppIconName }[] = [
  { id: 'members', label: 'Members', icon: 'IconPeople' },
  { id: 'assignees', label: 'Assignees', icon: 'IconPeopleCircle' },
  { id: 'category', label: category.label, icon: category.icon },
  { id: 'status', label: status.label, icon: status.icon },
  { id: 'labels', label: 'Labels', icon: 'IconTag' },
  { id: 'priority', label: priority.label, icon: priority.icon },
  { id: 'avatar', label: 'Avatar', icon: 'IconPeopleCircle' },
  { id: 'lastMessage', label: 'Last message', icon: 'IconBubble3' },
];

export function visibleChannelFieldCount(fields: ChannelFields): number {
  return CHANNEL_FIELDS.filter(({ id }) => fields[id]).length;
}
