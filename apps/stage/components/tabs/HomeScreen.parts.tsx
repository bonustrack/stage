
import { memo, useCallback, useEffect, useState } from 'react';

import { DevSettings, Vibration } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';
import { Spinner } from '../Spinner';
import { ChannelRow } from '../ChannelRow';
import {
  resetXmtpClient, shortAddress, prefetchFeed, lineOfConv, useActiveAccount,
} from '../../modules/messaging';
import { resetAccount } from '../../lib/wallet';
import { getPeerName, isPeerResolved } from '../../lib/peerProfiles';
import { getDraft } from '../../lib/drafts';
import { requestLabelFilter } from '../../lib/labelFilterRequest';
import { conversationLinkOf } from '../../lib/conversationLink';
import { capabilities } from '../../lib/capabilities';
import type { Row as RowT } from './HomeScreen.helpers';
import { channelTimestamp } from '../../lib/format';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { getActiveAccount } from '../../lib/accounts';
import { homeEmptyActionModel } from './HomeScreen.empty.model';

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
}

function ChannelRowItemBase({
  item, router, setRowMenu, query, title, preview, avatarAddress, pinned, draftText,
}: ChannelRowItemProps): React.ReactElement {
  const isGroup = !item.peerAddress;
  return (
    <ChannelRow
      title={title}
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
  deps: { channelProfilesVersion: number; draftsVersion: number; pinned: Set<string>; query?: string },
): ({ item }: { item: RowT }) => React.ReactElement {
  const { channelProfilesVersion, draftsVersion, pinned, query } = deps;
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
    />
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

function useActiveAddress(): string | null {
  const accountEpoch = useActiveAccount();
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getActiveAccount().then(acct => {
      if (!cancelled) setAddress(acct?.address ?? null);
    });
    return () => { cancelled = true; };
  }, [accountEpoch]);
  return address;
}

export function HomeEmpty({ onStartConversation }: { onStartConversation: () => void }): React.ReactElement {
  const address = useActiveAddress();
  const dark = useEffectiveColorScheme() === 'dark';
  const { bg, text } = usePalette();
  const model = homeEmptyActionModel(address);
  const copyAddress = (): void => {
    if (!address) return;
    void capabilities.copyToClipboard(address);
    capabilities.toast('Address copied');
  };

  return (
    <Col flex={1} minHeight={420} align="center" justify="center" gap={14} padding={24}>
      <Text value={model.title} weight="semibold" textAlign="center" />
      <Text value={model.body} size="sm" role="secondary" textAlign="center" />
      <Button
        dark={dark}
        size="lg"
        label={model.startLabel}
        onPress={onStartConversation}
        iconStart={<Icon name="plus" size={18} color={bg} />}
        style={{ alignSelf: 'center' }}
      />
      {model.addressLabel ? (
        <Button
          dark={dark}
          color="secondary"
          variant="soft"
          size="md"
          label={model.addressLabel}
          onPress={copyAddress}
          iconStart={<Icon name="copy" size={18} color={text} />}
          iconEnd={<Text value={model.addressHint} size="xs" weight="semibold" role="secondary" />}
          style={{ alignSelf: 'center' }}
        />
      ) : null}
    </Col>
  );
}
