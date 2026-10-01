import { Children, cloneElement, isValidElement, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { useConvMetas, getCachedRows, subscribeCachedRows } from '../../modules/messaging';
import { cachedChannelName, channelLinkText } from '../../lib/channelLinks';
import { conversationLinkOf } from '../../lib/links';
import { useEffectiveColorScheme } from '../../lib/theme';
import { MESSAGE_LINK_COLOR } from '../../lib/uiColors';
import { MESSAGE_LINK_STYLE, type LinkPress } from './helpers';
import { bubbleLinkProps } from './linkProps';

export function useChannelLinkNames(convIds: readonly string[]) {
  const metas = useConvMetas(convIds);
  const rows = useSyncExternalStore(subscribeCachedRows, getCachedRows);
  return new Map(convIds.map((id, i) => [id, {
    groupName: cachedChannelName(rows, id) ?? metas[i]?.groupName,
    peerAddr: metas[i]?.peerAddr,
  }]));
}

function namedChildren(children: ReactNode, name: string): ReactNode {
  const [first] = Children.toArray(children);
  return isValidElement<{ children?: ReactNode }>(first)
    ? cloneElement(first, {}, namedChildren(first.props.children, name)) : name;
}

export function ChannelLink({ convId, label, url, text, fg, onLinkPress, element }: {
  convId: string; label?: string; url?: string; text?: string; fg?: string;
  onLinkPress?: LinkPress; element?: React.ReactElement<ComponentProps<typeof Text>>;
}): React.ReactElement {
  const router = useRouter();
  const link = MESSAGE_LINK_COLOR[useEffectiveColorScheme()];
  const meta = useChannelLinkNames([convId]).get(convId) ?? {};
  const name = channelLinkText(meta, label, url, text);
  const props = url ? bubbleLinkProps(url, onLinkPress) : {
    onPress: () => { router.push(conversationLinkOf(convId)); },
  };
  if (element) return cloneElement(element, props, namedChildren(element.props.children, name));
  return (
    <Text size="2xl" color={fg ?? link} style={MESSAGE_LINK_STYLE} accessibilityRole="link"
      {...props} role="link" suppressHighlighting>
      {name}
    </Text>
  );
}
