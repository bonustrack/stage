import { channelFieldOf, type ChannelField } from '@stage-labs/client/xmtp/labels';
import { uniqueKeys } from '../conversation/SidebarSection.model';

export function configuredFieldOptions(
  field: Exclude<ChannelField, 'priority'>, observed: readonly string[], order: readonly string[],
): string[] {
  const names = new Map(observed.map(value => [value.toLowerCase(), value]));
  const prefix = `${field}:`;
  const configured = order.flatMap(key => {
    const value = key.startsWith(prefix) ? channelFieldOf(field, key.slice(prefix.length)) : null;
    return value === null ? [] : [names.get(value.toLowerCase()) ?? value];
  });
  return uniqueKeys([...configured, ...observed]);
}
