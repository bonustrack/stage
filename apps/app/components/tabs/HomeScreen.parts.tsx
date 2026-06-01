/** HomeScreen presentational parts — the error/spinner/empty states and the
 *  "Message requests" list header, extracted from HomeScreen.tsx (phase-2 lint,
 *  rendering identical). */

import { useCallback } from 'react';
import { DevSettings, Pressable, Vibration } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box, Col } from '../layout';
import { Spinner } from '../Spinner';
import { ChannelRow } from '../ChannelRow';
import { resetXmtpClient, shortAddress } from '../../lib/xmtp';
import { resetAccount } from '../../lib/wallet';
import { getPeerAvatarCb, getPeerName, isPeerResolved } from '../../lib/peerProfiles';
import { hasDraft } from '../../lib/drafts';
import { isPinned } from '../../lib/pins';
import type { Row as RowT } from './HomeScreen.helpers';
import { fmtTs } from './HomeScreen.helpers';

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
    const senderPrefix = item.lastFromSelf
      ? 'You: '
      : item.lastSenderAddress
        ? `${getPeerName(item.lastSenderAddress) ?? shortAddress(item.lastSenderAddress)}: `
        : '';
    const preview = item.lastPreview
      ? `${senderPrefix}${item.lastPreview}`
      : '(no messages yet)';
    const showAddr = !item.avatarUri && item.avatarAddress && isPeerResolved(item.avatarAddress)
      ? item.avatarAddress : null;
    return (
      <ChannelRow
        title={displayTitle}
        avatarUri={item.avatarUri}
        avatarAddress={showAddr}
        cacheBuster={item.avatarAddress ? getPeerAvatarCb(item.avatarAddress) : undefined}
        square={!item.peerAddress}
        lastPreview={preview}
        timestamp={fmtTs(item.lastTs)}
        unreadCount={item.unreadCount}
        markedUnread={item.markedUnread}
        pinned={isPinned(item.convId)}
        hasDraft={hasDraft(item.convId)}
        onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
        onLongPress={() => {
          /** Tiny haptic-style buzz when the long-press opens the row menu.
           *  RN core Vibration (no native dep / rebuild needed); ~10ms = a subtle tap. */
          Vibration.vibrate(10);
          setRowMenu({
            convId: item.convId,
            title: item.peerAddress ? (getPeerName(item.peerAddress) ?? item.title) : item.title,
            isUnread: item.unreadCount > 0 || !!item.markedUnread,
            isGroup: !item.peerAddress,
            peerAddress: item.peerAddress,
          });
        }}
      />
    );
  }, [router, setRowMenu, channelProfilesVersion, draftsVersion, pinned]);
}

/** XMTP-init failure recovery screen — message + "Reset XMTP identity" button. */
export function HomeError({ error, dark, fg, bg }: {
  error: string; dark: boolean; fg: string; bg: string;
}): React.ReactElement {
  return (
    <Col flex={1} align="center" justify="center" p={24} bg={bg}>
      <Text style={{ color: fg, fontSize: 15, textAlign: 'center', marginBottom: 16 , fontFamily: 'Calibre-Medium'}}>{error}</Text>
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
        <Text style={{ color: dark ? '#ff6b80' : '#b91c1c', fontSize: 14 , fontFamily: 'Calibre-Medium'}}>
          Reset XMTP identity
        </Text>
      </Pressable>
    </Col>
  );
}

/** Centred spinner shown while the cache is cold + XMTP is booting. */
export function HomeSpinner({ head, bg }: { head: string; bg: string }): React.ReactElement {
  return (
    <Col flex={1} align="center" justify="center" bg={bg}>
      <Spinner size={28} color={head} />
    </Col>
  );
}

/** Empty-list placeholder (no conversations yet). */
export function HomeEmpty({ sub }: { sub: string }): React.ReactElement {
  return (
    <Col p={32} align="center">
      <Text style={{ color: sub, textAlign: 'center' }}>
        No conversations yet. Share your address from Settings to start one.
      </Text>
    </Col>
  );
}

/** "Message requests (N)" list header — only rendered when requestCount > 0. */
export function RequestsHeader({ requestCount, dark, head, sub, border, onPress }: {
  requestCount: number; dark: boolean; head: string; sub: string; border: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: border,
        backgroundColor: pressed ? (dark ? '#1a1a1c' : '#f2f2f4') : 'transparent',
      })}
    >
      <Box radius={20} bg={border} align="center" justify="center" style={{ width: 40, height: 40 }}>
        <Icon name="envelope" size={20} color={head} />
      </Box>
      <Col flex={1}>
        <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
          Message requests
        </Text>
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
          {requestCount} pending
        </Text>
      </Col>
      <Box px={9} py={3} radius={999} bg={dark ? '#3a3a3c' : '#e4e4e8'}>
        <Text style={{ color: head, fontSize: 13, fontFamily: 'Calibre-Medium' }}>{requestCount}</Text>
      </Box>
    </Pressable>
  );
}
