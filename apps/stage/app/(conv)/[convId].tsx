
import { useCallback, useState } from 'react';

import { Animated as RNAnimated, Platform, type ViewStyle } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '../../components/Spinner';
import { Box, Col, WEB_EDGE_SCROLL, WEB_EDGE_CONTENT_WIDE, WEB_CHROME_WIDTH, WEB_CHROME_SHIFT } from '../../components/layout';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { PendingConversation } from '../../components/PendingConversation';
import { ConversationFeed } from '../../components/xmtp-conv/ConversationFeed';
import { ConversationSearch } from '../../components/xmtp-conv/ConversationSearch';
import { useConversationState } from '../../components/xmtp-conv/useConversationState';
import {
  useSearchKeyboardFocus, useResolvedConvId, type ResolveConvError,
} from './conv.hooks';
import {
  ConversationTopnav, ConversationFooter, ConversationOverlays, ConversationSearchTopnav,
} from './conv.screen-parts';

function resolveErrorMessage(error: ResolveConvError): string {
  if (error === 'unregistered') return 'This address is not on XMTP yet. Ask them to sign in once, then retry.';
  if (error === 'stale-installations') return 'This contact has not used XMTP in a while, so their keys expired. They need to open an XMTP app before you can message them.';
  if (error === 'failed') return 'Could not open this conversation.';
  return 'Missing conversation id.';
}

function UnresolvedConversation({ resolved, dark }: {
  resolved: ReturnType<typeof useResolvedConvId>;
  dark: boolean;
}): React.ReactElement {
  if (resolved.resolving) {
    return (
      <Col surface="surface" flex={1} align="center" justify="center" style={WEB_EDGE_SCROLL}>
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
        {resolveErrorMessage(resolved.error)}
      </Text>
      <Button dark={dark} variant="soft" label="Try again" style={{ alignSelf: 'center' }} onPress={resolved.retry}/>
    </Col>
  );
}

function FooterDock({ children, onHeight }: {
  children: React.ReactNode; onHeight: (h: number) => void;
}): React.ReactElement {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Box
      width={WEB_CHROME_WIDTH}
      margin={{ left: WEB_CHROME_SHIFT }}
      style={{ position: 'absolute', bottom: 0, left: '50%', zIndex: 2 } as unknown as ViewStyle}
      onLayout={(e) => { onHeight(e.nativeEvent.layout.height); }}
>
      <Box style={WEB_EDGE_CONTENT_WIDE}>
        {children}
      </Box>
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
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg, rowBg = border;
  const { convId: routeParam, focus } = useLocalSearchParams<{ convId: string; focus?: string }>();
  const resolved = useResolvedConvId(routeParam);
  const convId = resolved.convId ?? undefined;
  const c = useConversationState(convId, focus);
  const { activeLine } = c;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const closeSearch = useCallback(() => { setSearchOpen(false); setSearchQuery(''); }, []);
  const searchInputRef = useSearchKeyboardFocus(searchOpen);

  const [requestPending, setRequestPending] = useState(false);
  const onRequestPending = useCallback((pending: boolean) => { setRequestPending(pending); }, []);
  const [composerH, setComposerH] = useState(0);

  const insets = useSafeAreaInsets();
  const { height: kbHeightShared } = useReanimatedKeyboardAnimation();
  const listWrapperStyle = useAnimatedStyle(() => ({ marginBottom: Math.max(0, -kbHeightShared.value - insets.bottom) }));

  if (resolved.resolving || !convId) {
    return (
      <ConversationShell bg={bg}>
        <UnresolvedConversation resolved={resolved} dark={dark}/>
      </ConversationShell>
    );
  }

  const footer = (
    <ConversationFooter
      c={c} convId={convId} dark={dark} rowBg={rowBg} insets={insets}
      requestPending={requestPending} onRequestPending={onRequestPending}
/>
  );

  return (
    <ConversationShell bg={bg}>
      {}
      <Reanimated.View
        style={[
          Platform.OS === 'web'
            ? { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }
            : { flex: 1 },
          listWrapperStyle,
        ]}
>
      <ConversationFeed
        c={c}
        convId={convId}
        dark={dark}
        head={head}
        sub={sub}
        fg={fg}
        border={border}
        rowBg={rowBg}
        insets={insets}
        bottomInset={composerH}
        router={router}
        searchSlot={searchOpen && searchQuery.trim().length >= 2 ? (
          <ConversationSearch
            line={activeLine}
            query={searchQuery}
            sub={sub}
            bg={bg}
            c={c}
            dark={dark}
            router={router}
/>
        ) : undefined}
/>
      </Reanimated.View>
      {}
      {searchOpen ? (
        <ConversationSearchTopnav
          searchInputRef={searchInputRef}
          border={border} head={head} sub={sub}
          query={searchQuery} setQuery={setSearchQuery} onClose={closeSearch} topInset={insets.top}
/>
      ) : (
        <ConversationTopnav c={c} convId={convId} fg={fg} head={head} border={border} insets={insets} router={router}/>
      )}
      <FooterDock onHeight={setComposerH}>{footer}</FooterDock>
      {}
      <ConversationOverlays
        c={c} convId={convId} dark={dark}
        onOpenSearch={() => { setSearchQuery(''); setSearchOpen(true); }}
/>
    </ConversationShell>
  );
}
