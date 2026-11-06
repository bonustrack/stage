import type { AppIconName } from '../appIcons';
import type { ChannelField, ChannelFields } from '../../lib/channelFields.model';

export const CHANNEL_FIELDS: readonly { id: ChannelField; label: string; icon?: AppIconName }[] = [
  { id: 'members', label: 'Members', icon: 'IconPeople' },
  { id: 'assignees', label: 'Assignees', icon: 'IconPeopleCircle' },
  { id: 'category', label: 'Project', icon: 'IconFolder1' },
  { id: 'status', label: 'Status', icon: 'IconCircleDashed' },
  { id: 'labels', label: 'Labels', icon: 'IconTag' },
  { id: 'priority', label: 'Priority', icon: 'IconFlag1' },
  { id: 'avatar', label: 'Avatar', icon: 'IconPeopleCircle' },
  { id: 'lastMessage', label: 'Last message', icon: 'IconBubble3' },
];

export function visibleChannelFieldCount(fields: ChannelFields): number {
  return CHANNEL_FIELDS.filter(({ id }) => fields[id]).length;
}
