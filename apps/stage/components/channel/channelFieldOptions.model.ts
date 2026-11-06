import { channelFieldOf, type ChannelField } from '@stage-labs/client/xmtp/channelMeta';
import { uniqueKeys } from '@stage-labs/client/collections';
import { groupValueOf } from '../../lib/grouping.model';

export function configuredFieldOptions(
  field: Exclude<ChannelField, 'priority'>,
  observed: readonly string[],
  order: readonly string[],
): string[] {
  const names = new Map(observed.map((value) => [value.toLowerCase(), value]));
  const configured = order.flatMap((key) => {
    const raw = groupValueOf(field, key);
    const value = raw === null ? null : channelFieldOf(field, raw);
    return value === null ? [] : [names.get(value.toLowerCase()) ?? value];
  });
  return uniqueKeys([...configured, ...observed]);
}
