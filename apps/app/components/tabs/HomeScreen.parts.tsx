/** HomeScreen presentational parts — the error/spinner/empty states and the
 *  "Message requests" list header, extracted from HomeScreen.tsx (phase-2 lint,
 *  rendering identical). */

import { useCallback } from 'react';

import { DevSettings, Vibration } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
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

type RowMenu = { convId: string; title: string; isUnread: boolean; isGroup: boolean; peerAddress: string | null };

/** #6: hoisted renderItem so its identity is stable across stream ticks (only
 *  re-created when a resolution version changes), letting memoised ChannelRow
 *  skip rows whose props are unchanged. Versions drive re-creation so
 *  name/avatar/pin/draft resolutions repaint. */
export function useChannelRowRenderer(
  router: { push: (to: { pathname: string; params: { convId: string } }) => void },
  setRowMenu: (m: RowMenu) => void,
  deps: { channelProfilesVersion: number; draftsVersion: number; pinned: Set<string> },
): ({ item }: { item: RowT }) => React.ReactElement {
  const { channelProfilesVersion, draftsVersion, pinned } = deps;
  /** Versions drive re-creation so name/avatar/pin/draft resolutions repaint.
   *  (deps intentionally partial — react-hooks/exhaustive-deps not enabled.) */
  return useCallback(({ item }: { item: RowT }): React.ReactElement => {
    const displayTitle = item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title;
    /** Self prefix resolves our own stamp name (lastSenderAddress is set for self
     *  too); falls back to "You" only until the profile lands. */
    const senderPrefix = item.lastFromSelf
      ? `${(item.lastSenderAddress && getPeerName(item.lastSenderAddress)) ?? 'You'}: `
      : item.lastSenderAddress
        ? `${getPeerName(item.lastSenderAddress) ?? shortAddress(item.lastSenderAddress)}: `
        : '';
    const preview = item.lastPreview
      ? `${senderPrefix}${item.lastPreview}`
      : '(no messages yet)';
    /** Avatar address gate:
     *   - GROUP (peerAddress == null): the address IS the deterministic
     *     channel-id stamp seed — render it directly (no peer profile to
     *     resolve, and we must NEVER blank a group avatar). Skipped only when
     *     a group-uploaded image (avatarUri) takes precedence.
     *   - DM (peerAddress set): hold off until the peer profile resolves so we
     *     don't flash a cache-buster-less stamp before the real URL lands. */
    const isGroup = !item.peerAddress;
    const showAddr = item.avatarUri || !item.avatarAddress
      ? null
      : isGroup || isPeerResolved(item.avatarAddress)
        ? item.avatarAddress
        : null;
    return (
      <ChannelRow
        title={displayTitle}
        avatarUri={item.avatarUri}
        avatarAddress={showAddr}
        square={!item.peerAddress}
        lastPreview={preview}
        timestamp={fmtTs(item.lastTs)}
        unreadCount={item.unreadCount}
        markedUnread={item.markedUnread}
        pinned={isPinned(item.convId)}
        hasDraft={hasDraft(item.convId)}
        draftText={getDraft(item.convId)}
        labels={isGroup ? item.labels : undefined}
        /** Already on the Channels tab — requesting the filter fans out to this
         *  screen's live subscription, which sets labelFilter. No navigation
         *  needed; the nested chip Pressable swallows the tap so the row's
         *  onPress (open conversation) doesn't also fire. */
        onLabelPress={isGroup ? requestLabelFilter : undefined}
        /** Warm the feed cache the instant the row is touched (before the push
         *  animation finishes) so the conversation screen opens from cache. */
        onPressIn={() => prefetchFeed(lineOfConv(item.convId))}
        onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
        onLongPress={() => {
          /** Tiny haptic-style buzz when the long-press opens the row menu.
           *  RN core Vibration (no native dep / rebuild needed); ~10ms = a subtle tap. */
          Vibration.vibrate(10);
          setRowMenu({
            convId: item.convId,
            title: item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title,
            isUnread: item.unreadCount> 0 || !!item.markedUnread,
            isGroup: !item.peerAddress,
            peerAddress: item.peerAddress,
          });
        }}
/>
    );
  }, [router, setRowMenu, channelProfilesVersion, draftsVersion, pinned]);
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

/** Empty-list placeholder. Default copy is "no conversations yet"; pass a
 *  message (e.g. the search "No matches" state) to override it. */
export function HomeEmpty({ sub, message }: { sub: string; message?: string }): React.ReactElement {
  return (
    <Col padding={32} align="center">
      <Text color={sub} style={{ textAlign: 'center' }}>
        {message ?? 'No conversations yet. Share your address from Settings to start one.'}
      </Text>
    </Col>
  );
}
