
import { useCallback, useState } from 'react';

import { Animated as RNAnimated } from 'react-native';
import { Text } from '@stage-labs/kit/text';
import { Col } from '../../components/layout';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { ConversationFeed } from '../../components/xmtp-conv/ConversationFeed';
import { ConversationSearch } from '../../components/xmtp-conv/ConversationSearch';
import { useConversationState } from '../../components/xmtp-conv/useConversationState';
import { useSearchKeyboardFocus, useArchivedFlag } from './conv.hooks';
import {
  ConversationTopnav, ConversationFooter, ConversationOverlays, ConversationSearchTopnav,
} from './conv.screen-parts';

export default function XmtpConversation(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg, rowBg = border;
  const { convId, focus } = useLocalSearchParams<{ convId: string; focus?: string }>();
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

  if (!convId) {
    return (
      <Col surface="surface" flex={1} align="center" justify="center">
        <Text color={sub}>Missing conversation id.</Text>
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
