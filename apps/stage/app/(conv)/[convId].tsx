
import { useCallback, useState } from 'react';

import { Animated as RNAnimated, Platform } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '../../components/Spinner';
import { Box, Col, PANE_LEFT_PAD, pinnedBottom, viewportFill } from '../../components/layout';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { PendingConversation } from '../../components/PendingConversation';
import { ConversationFeed } from '../../components/conversation/ConversationFeed';
import { ConversationSearch } from '../../components/conversation/ConversationSearch';
import { useConversationState } from '../../components/conversation/useConversationState';
import {
  useSearchKeyboardFocus, useResolvedConvId, type ResolveConvError,
} from '../../components/conversation/conv.hooks';
import {
  ConversationTopnav, ConversationFooter, ConversationOverlays, ConversationSearchTopnav,
} from '../../components/conversation/conv.screen-parts';

function resolveErrorMessage(error: ResolveConvError, detail?: string): string {
  if (error === 'unregistered') return 'This address is not on XMTP yet. Ask them to sign in once, then retry.';
  if (error === 'stale-installations') return 'This contact has not used XMTP in a while, so their keys expired. They need to open an XMTP app before you can message them.';
  if (error === 'failed') return detail ? `Could not open this conversation. ${detail}` : 'Could not open this conversation.';
  return 'Missing conversation id.';
}

function UnresolvedConversation({ resolved }: {
  resolved: ReturnType<typeof useResolvedConvId>;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  if (resolved.resolving) {
    return (
      <Col surface="surface" flex={1} align="center" justify="center" style={[viewportFill(), PANE_LEFT_PAD]}>
        <Spinner size={24} color={dark ? '#ffffff' : '#000000'}/>
      </Col>
    );
  }
  if (resolved.pendingAddress && resolved.error) {
    return (
      <PendingConversation
        address={resolved.pendingAddress}
        reason={resolved.error}
        onDelivered={resolved.retry}
        dark={dark}
      />
    );
  }
  return (
    <Col surface="surface" flex={1} align="center" justify="center" gap={16} padding={24}>
      <Text role="secondary" textAlign="center">
        {resolveErrorMessage(resolved.error, resolved.detail)}
      </Text>
      <Button dark={dark} variant="soft" label="Try again" style={{ alignSelf: 'center' }} onPress={resolved.retry}/>
    </Col>
  );
}

let measuredFooterHeight = 0;

function FooterDock({ children, onHeight }: {
  children: React.ReactNode; onHeight: (h: number) => void;
}): React.ReactElement {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Box
      style={pinnedBottom(2)}
      onLayout={(e) => {
        measuredFooterHeight = e.nativeEvent.layout.height;
        onHeight(measuredFooterHeight);
      }}
>
      {children}
    </Box>
  );
}

function ConversationShell({ bg, children }: {
  bg: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <RNAnimated.View style={{ flex: 1, backgroundColor: bg }}>
      {children}
    </RNAnimated.View>
  );
}

export default function XmtpConversation(): React.ReactElement {
  const { bg } = usePalette();
  const { convId: routeParam, focus } = useLocalSearchParams<{ convId: string; focus?: string }>();
  const pathname = usePathname();
  const resolved = useResolvedConvId(routeParam, !pathname.startsWith('/channel/'));
  const convId = resolved.convId ?? undefined;
  const c = useConversationState(convId, focus);
  const { activeLine } = c;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const closeSearch = useCallback(() => { setSearchOpen(false); setSearchQuery(''); }, []);
  const searchInputRef = useSearchKeyboardFocus(searchOpen);

  const [composerH, setComposerH] = useState(measuredFooterHeight);

  const insets = useSafeAreaInsets();
  const { height: kbHeightShared } = useReanimatedKeyboardAnimation();
  const listWrapperStyle = useAnimatedStyle(() => ({ marginBottom: Math.max(0, -kbHeightShared.value - insets.bottom) }));

  if (resolved.resolving || !convId) {
    return (
      <ConversationShell bg={bg}>
        <UnresolvedConversation resolved={resolved}/>
      </ConversationShell>
    );
  }

  return (
    <ConversationShell bg={bg}>
      <Reanimated.View
        style={[{ flex: 1 }, listWrapperStyle]}
>
      <ConversationFeed
        c={c}
        convId={convId}
        bottomInset={composerH}
        searchSlot={searchOpen && searchQuery.trim().length >= 2 ? (
          <ConversationSearch line={activeLine} query={searchQuery} c={c}/>
        ) : undefined}
/>
      </Reanimated.View>
      {searchOpen ? (
        <ConversationSearchTopnav
          searchInputRef={searchInputRef}
          query={searchQuery} setQuery={setSearchQuery} onClose={closeSearch}
/>
      ) : (
        <ConversationTopnav c={c} convId={convId}/>
      )}
      <FooterDock onHeight={setComposerH}><ConversationFooter c={c} convId={convId}/></FooterDock>
      <ConversationOverlays
        c={c} convId={convId}
        onOpenSearch={() => { setSearchQuery(''); setSearchOpen(true); }}
/>
    </ConversationShell>
  );
}
