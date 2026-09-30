import { useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { useConvMeta, getCachedRows, subscribeCachedRows } from '../../modules/messaging';
import { cachedChannelName, channelLinkLabel } from '../../lib/channelLinks';
import { conversationLinkOf } from '../../lib/links';
import { useEffectiveColorScheme } from '../../lib/theme';
import { MESSAGE_LINK_COLOR } from '../../lib/uiColors';
import { HighlightText } from '../HighlightText';
import { MESSAGE_LINK_STYLE, type LinkPress } from './helpers';
import { bubbleLinkProps } from './linkProps';

export function ChannelLink({ convId, label, url, fg, onLinkPress, plain, query }: {
  convId: string; label?: string; url?: string; fg?: string;
  onLinkPress?: LinkPress; plain?: boolean; query?: string;
}): React.ReactElement {
  const router = useRouter();
  const link = MESSAGE_LINK_COLOR[useEffectiveColorScheme()];
  const meta = useConvMeta(convId);
  const rows = useSyncExternalStore(subscribeCachedRows, getCachedRows);
  const groupName = meta.groupName?.trim() ? meta.groupName : cachedChannelName(rows, convId);
  const name = channelLinkLabel(groupName, label);
  if (plain) return query ? <HighlightText text={name} query={query} fg={fg ?? link} inline /> : <Text size="3xl" color={fg}>{name}</Text>;
  const props = url ? bubbleLinkProps(url, onLinkPress) : {
    onPress: () => { router.push(conversationLinkOf(convId)); },
  };
  return (
    <Text size="3xl" color={fg ?? link} style={MESSAGE_LINK_STYLE} accessibilityRole="link"
      {...props} role="link" suppressHighlighting>
      {name}
    </Text>
  );
}
