import { Children, cloneElement, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import { useConvRows } from '../../modules/messaging/queries';
import { channelLinkText } from '@stage-labs/client/xmtp/channelLinks';
import { conversationLinkOf } from '../../lib/links';
import { useEffectiveColorScheme } from '../../lib/theme';
import { MESSAGE_LINK_COLOR } from '../../lib/uiColors';
import { MESSAGE_LINK_STYLE, type LinkPress } from './helpers';
import { bubbleLinkProps } from './linkProps';

interface LinkNames { groupName?: string; peerAddress?: string | null }

const NO_NAMES: LinkNames = {};

export function useChannelLinkNames(convIds: readonly string[]): Map<string, LinkNames> {
  const rows = useConvRows(convIds);
  return new Map(convIds.map((id, i) => [id, rows[i] ?? NO_NAMES]));
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
  const meta = useChannelLinkNames([convId]).get(convId) ?? NO_NAMES;
  const name = channelLinkText(meta, label, url, text);
  const props = url ? bubbleLinkProps(url, onLinkPress) : {
    onPress: () => { router.push(conversationLinkOf(convId)); },
  };
  if (element) return cloneElement(element, props, namedChildren(element.props.children, name));
  return (
    <Text size="lg" color={fg ?? link} style={MESSAGE_LINK_STYLE} accessibilityRole="link"
      {...props} role="link" suppressHighlighting>
      {name}
    </Text>
  );
}
