
import { memo, useCallback } from 'react';

import { DevSettings, Vibration } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col, WEB_EDGE_SCROLL } from '../layout';
import { EmptyState } from '../chrome/EmptyState';
import { Spinner } from '../Spinner';
import { ChannelRow } from '../ChannelRow';
import { resetXmtpClient, shortAddress, prefetchFeed, lineOfConv } from '../../modules/messaging';
import { resetAccount } from '../../lib/wallet';
import { getPeerName, isPeerResolved } from '../../lib/peerProfiles';
import { getDraft } from '../../lib/drafts';
import { requestLabelFilter } from '../../lib/labelFilterRequest';
import { conversationLinkOf, isActiveConversationPath } from '../../lib/conversationLink';
import type { Row as RowT } from './HomeScreen.helpers';
import { channelTimestamp } from '../../lib/format';
import { DANGER } from '../../lib/theme';

interface RowMenu { convId: string; title: string; isUnread: boolean; isGroup: boolean; peerAddress: string | null }

function rowTitle(item: RowT): string {
  return item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title;
}

function rowPreview(item: RowT): string {
  if (!item.lastPreview) return '(no messages yet)';
  let prefix = '';
  if (item.lastFromSelf) {
    prefix = `${(item.lastSenderAddress && getPeerName(item.lastSenderAddress)) ?? 'You'}: `;
  } else if (item.lastSenderAddress) {
    prefix = `${getPeerName(item.lastSenderAddress) ?? shortAddress(item.lastSenderAddress)}: `;
  }
  return `${prefix}${item.lastPreview}`;
}

function rowAvatarAddress(item: RowT, isGroup: boolean): string | null {
  if (item.avatarUri || !item.avatarAddress) return null;
  if (isGroup || isPeerResolved(item.avatarAddress)) return item.avatarAddress;
  return null;
}

interface ChannelRowItemProps {
  item: RowT;
  router: { push: (to: { pathname: string; params: { convId: string } }) => void };
  setRowMenu: (m: RowMenu) => void;
  query?: string;
  title: string;
  preview: string;
  avatarAddress: string | null;
  pinned: boolean;
  draftText: string;
  active: boolean;
}

function ChannelRowItemBase({
  item, router, setRowMenu, query, title, preview, avatarAddress, pinned, draftText, active,
}: ChannelRowItemProps): React.ReactElement {
  const isGroup = !item.peerAddress;
  return (
    <ChannelRow
      title={title}
      active={active}
      highlightQuery={query}
      avatarUri={item.avatarUri}
      avatarAddress={avatarAddress}
      square={isGroup}
      lastPreview={preview}
      timestamp={channelTimestamp(item.lastTs)}
      unreadCount={item.unreadCount}
      markedUnread={item.markedUnread}
      pinned={pinned}
      hasDraft={draftText.trim().length > 0}
      draftText={draftText}
      labels={isGroup ? item.labels : undefined}
      onLabelPress={isGroup ? requestLabelFilter : undefined}
      onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
      onPress={() => { router.push(conversationLinkOf(item.convId, item.peerAddress)); }}
      onLongPress={() => {
        Vibration.vibrate(10);
        setRowMenu({
          convId: item.convId, title,
          isUnread: item.unreadCount > 0 || item.markedUnread,
          isGroup, peerAddress: item.peerAddress,
        });
      }}
    />
  );
}

const ChannelRowItem = memo(ChannelRowItemBase);

export function useChannelRowRenderer(
  router: { push: (to: { pathname: string; params: { convId: string } }) => void },
  setRowMenu: (m: RowMenu) => void,
  deps: {
    channelProfilesVersion: number; draftsVersion: number;
    pinned: Set<string>; query?: string; activePath: string;
  },
): ({ item }: { item: RowT }) => React.ReactElement {
  const { channelProfilesVersion, draftsVersion, pinned, query, activePath } = deps;
  return useCallback(({ item }: { item: RowT }): React.ReactElement => (
    <ChannelRowItem
      item={item}
      router={router}
      setRowMenu={setRowMenu}
      query={query}
      title={rowTitle(item)}
      preview={rowPreview(item)}
      avatarAddress={rowAvatarAddress(item, !item.peerAddress)}
      pinned={pinned.has(item.convId)}
      draftText={getDraft(item.convId)}
      active={isActiveConversationPath(activePath, item.convId, item.peerAddress)}
    />
  ), [router, setRowMenu, channelProfilesVersion, draftsVersion, pinned, query, activePath]);
}

export function HomeError({ error, dark, fg, plain }: {
  error: string; dark: boolean; fg: string; plain?: boolean;
}): React.ReactElement {
  return (
    <Col padding={24} flex={1} align="center" justify="center" surface="surface" style={plain === true ? undefined : WEB_EDGE_SCROLL}>
      <Text size="md" color={fg} style={{ textAlign: 'center', marginBottom: 16 }}>{error}</Text>
      <Pressable
        onPress={() => {
          void (async (): Promise<void> => {
            await resetXmtpClient();
            await resetAccount();
            DevSettings.reload?.();
          })();
        }}
        style={({ pressed }) => ({
          paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
          backgroundColor: pressed ? '#5c2231' : 'transparent',
          borderWidth: 1, borderColor: dark ? '#5c2231' : '#e9bbc4',
        })}
>
        <Text size="md" color={DANGER}>
          Reset XMTP identity
        </Text>
      </Pressable>
    </Col>
  );
}

export function HomeSpinner({ head, plain }: { head: string; plain?: boolean }): React.ReactElement {
  return (
    <Col flex={1} align="center" justify="center" surface="surface" style={plain === true ? undefined : WEB_EDGE_SCROLL}>
      <Spinner size={28} color={head}/>
    </Col>
  );
}

export function HomeEmpty({ message }: { message?: string }): React.ReactElement {
  return (
    <EmptyState title={message ?? 'No conversations yet. Share your address from Settings to start one.'} />
  );
}
