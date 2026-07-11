
import { useCallback, useState } from 'react';

import { Animated as RNAnimated } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '../../components/Spinner';
import { Col } from '../../components/layout';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { ConversationFeed } from '../../components/xmtp-conv/ConversationFeed';
import { ConversationSearch } from '../../components/xmtp-conv/ConversationSearch';
import { useConversationState } from '../../components/xmtp-conv/useConversationState';
import {
  useSearchKeyboardFocus, useArchivedFlag, useResolvedConvId, type ResolveConvError,
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

  const archived = useArchivedFlag(convId);

  const insets = useSafeAreaInsets();
  const { height: kbHeightShared } = useReanimatedKeyboardAnimation();
  const listWrapperStyle = useAnimatedStyle(() => ({ marginBottom: Math.max(0, -kbHeightShared.value - insets.bottom) }));

  if (resolved.resolving) {
    return (
      <Col surface="surface" flex={1} align="center" justify="center">
        <Spinner size={24} color={dark ? '#ffffff' : '#000000'}/>
      </Col>
    );
  }

  if (!convId) {
    return (
      <Col surface="surface" flex={1} align="center" justify="center" gap={16} padding={24}>
        <Text role="secondary" textAlign="center">
          {resolveErrorMessage(resolved.error)}
        </Text>
        <Button dark={dark} variant="soft" label="Try again" style={{ alignSelf: 'center' }} onPress={resolved.retry}/>
      </Col>
    );
  }

  return (
    <RNAnimated.View
      style={{
        flex: 1, backgroundColor: bg,
      }}
>
      {}
      <Reanimated.View style={[{ flex: 1 }, listWrapperStyle]}>
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
      <ConversationFooter
        c={c} convId={convId} dark={dark} rowBg={rowBg} insets={insets}
        requestPending={requestPending} onRequestPending={onRequestPending}
/>
      {}
      <ConversationOverlays
        c={c} convId={convId} dark={dark} archived={archived}
        onOpenSearch={() => { setSearchQuery(''); setSearchOpen(true); }}
/>
    </RNAnimated.View>
  );
}
