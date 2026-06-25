
import { useCallback } from 'react';

import { DevSettings, Vibration } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetRoot } from '@stage-labs/kit/kit';
import { emptyState } from '@stage-labs/views';
import { Col } from '../layout';
import { Spinner } from '../Spinner';
import { ChannelRow } from '../ChannelRow';
import { resetXmtpClient, shortAddress, prefetchFeed, lineOfConv } from '../../modules/messaging';
import { resetAccount } from '../../lib/wallet';
import { getPeerName, isPeerResolved } from '../../lib/peerProfiles';
import { hasDraft, getDraft } from '../../lib/drafts';
import { isPinned } from '../../lib/pins';
import { requestLabelFilter } from '../../lib/labelFilterRequest';
import type { Row as RowT } from './HomeScreen.helpers';
import { fmtTs } from './HomeScreen.helpers';
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

function ChannelRowItem({ item, router, setRowMenu, query }: {
  item: RowT;
  router: { push: (to: { pathname: string; params: { convId: string } }) => void };
  setRowMenu: (m: RowMenu) => void;
  query?: string;
}): React.ReactElement {
  const isGroup = !item.peerAddress;
  return (
    <ChannelRow
      title={rowTitle(item)}
      highlightQuery={query}
      avatarUri={item.avatarUri}
      avatarAddress={rowAvatarAddress(item, isGroup)}
      square={!item.peerAddress}
      lastPreview={rowPreview(item)}
      timestamp={fmtTs(item.lastTs)}
      unreadCount={item.unreadCount}
      markedUnread={item.markedUnread}
      pinned={isPinned(item.convId)}
      hasDraft={hasDraft(item.convId)}
      draftText={getDraft(item.convId)}
      labels={isGroup ? item.labels : undefined}
      onLabelPress={isGroup ? requestLabelFilter : undefined}
      onPressIn={() => { prefetchFeed(lineOfConv(item.convId)); }}
      onPress={() => { router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } }); }}
      onLongPress={() => {
        Vibration.vibrate(10);
        setRowMenu({
          convId: item.convId, title: rowTitle(item),
          isUnread: item.unreadCount > 0 || item.markedUnread,
          isGroup: !item.peerAddress, peerAddress: item.peerAddress,
        });
      }}
    />
  );
}

export function useChannelRowRenderer(
  router: { push: (to: { pathname: string; params: { convId: string } }) => void },
  setRowMenu: (m: RowMenu) => void,
  deps: { channelProfilesVersion: number; draftsVersion: number; pinned: Set<string>; query?: string },
): ({ item }: { item: RowT }) => React.ReactElement {
  const { channelProfilesVersion, draftsVersion, pinned, query } = deps;
  return useCallback(({ item }: { item: RowT }): React.ReactElement => (
    <ChannelRowItem item={item} router={router} setRowMenu={setRowMenu} query={query} />
  ), [router, setRowMenu, channelProfilesVersion, draftsVersion, pinned, query]);
}

export function HomeError({ error, dark, fg }: {
  error: string; dark: boolean; fg: string; bg: string;
}): React.ReactElement {
  return (
    <Col padding={24} flex={1} align="center" justify="center" surface="surface">
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

export function HomeSpinner({ head }: { head: string; bg: string }): React.ReactElement {
  return (
    <Col flex={1} align="center" justify="center" surface="surface">
      <Spinner size={28} color={head}/>
    </Col>
  );
}

export function HomeEmpty({ message }: { message?: string }): React.ReactElement {
  const node: WidgetRoot = {
    type: 'Basic',
    children: [
      emptyState({
        title: message ?? 'No conversations yet. Share your address from Settings to start one.',
      }),
    ],
  };
  return <KitRenderer node={node} />;
}
