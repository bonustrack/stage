/** @file HomeScreen.parts — HomeScreen presentational pieces: error/spinner/empty states, the channel-row renderer hook, and the "Message requests" list header. */

import { useCallback } from 'react';

import { DevSettings, Vibration } from 'react-native';
import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
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

/** Resolve a row's display title from its peer profile, falling back to the stored title. */
function rowTitle(item: RowT): string {
  return item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title;
}

/** Build the last-message preview line, prefixing the resolved sender name. */
function rowPreview(item: RowT): string {
  if (!item.lastPreview) return '(no messages yet)';
  /** Self prefix resolves our own stamp name (set for self too); falls back to "You" until it lands. */
  let prefix = '';
  if (item.lastFromSelf) {
    prefix = `${(item.lastSenderAddress && getPeerName(item.lastSenderAddress)) ?? 'You'}: `;
  } else if (item.lastSenderAddress) {
    prefix = `${getPeerName(item.lastSenderAddress) ?? shortAddress(item.lastSenderAddress)}: `;
  }
  return `${prefix}${item.lastPreview}`;
}

/** Resolve the avatar address to render, or null. Groups render the deterministic stamp seed directly (unless avatarUri wins); DMs hold off until the peer profile resolves. */
function rowAvatarAddress(item: RowT, isGroup: boolean): string | null {
  if (item.avatarUri || !item.avatarAddress) return null;
  if (isGroup || isPeerResolved(item.avatarAddress)) return item.avatarAddress;
  return null;
}

/** Renders one channel row from its RowT, wired to navigation + the long-press menu. */
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
        Vibration.vibrate(10); /** ~10ms haptic buzz on long-press. */
        setRowMenu({
          convId: item.convId, title: rowTitle(item),
          isUnread: item.unreadCount > 0 || item.markedUnread,
          isGroup: !item.peerAddress, peerAddress: item.peerAddress,
        });
      }}
    />
  );
}

/** #6: hoisted renderItem with a stable identity across stream ticks (re-created only when a resolution version changes) so memoised ChannelRow skips unchanged rows while name/avatar/pin/draft resolutions still repaint. */
export function useChannelRowRenderer(
  router: { push: (to: { pathname: string; params: { convId: string } }) => void },
  setRowMenu: (m: RowMenu) => void,
  deps: { channelProfilesVersion: number; draftsVersion: number; pinned: Set<string>; query?: string },
): ({ item }: { item: RowT }) => React.ReactElement {
  const { channelProfilesVersion, draftsVersion, pinned, query } = deps;
  /** Versions drive re-creation so name/avatar/pin/draft resolutions repaint (deps intentionally partial — react-hooks/exhaustive-deps not enabled). */
  return useCallback(({ item }: { item: RowT }): React.ReactElement => (
    <ChannelRowItem item={item} router={router} setRowMenu={setRowMenu} query={query} />
  ), [router, setRowMenu, channelProfilesVersion, draftsVersion, pinned, query]);
}

/** XMTP-init failure recovery screen — message + "Reset XMTP identity" button. */
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

/** Centred spinner shown while the cache is cold + XMTP is booting. */
export function HomeSpinner({ head }: { head: string; bg: string }): React.ReactElement {
  return (
    <Col flex={1} align="center" justify="center" surface="surface">
      <Spinner size={28} color={head}/>
    </Col>
  );
}

/** Empty-list placeholder. Default copy is "no conversations yet"; pass a message (e.g. the search "No matches" state) to override it. */
export function HomeEmpty({ sub, message }: { sub: string; message?: string }): React.ReactElement {
  return (
    <Col padding={32} align="center">
      <Text color={sub} style={{ textAlign: 'center' }}>
        {message ?? 'No conversations yet. Share your address from Settings to start one.'}
      </Text>
    </Col>
  );
}
