/** @file XMTP conversation screen from the messenger tab list; state/handlers in useConversationState, presentation in components/xmtp-conv. */

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

/** Full-screen XMTP conversation thread with message composer and swipe-back. */
export default function XmtpConversation(): React.ReactElement {
  const router = useRouter();
  /** Full-screen swipe-back and the bubble's swipe-to-reply stay mutually exclusive by drag direction (rightward arms back, leftward arms reply), so no per-screen gesture-distance override is needed. */
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg, rowBg = border;
  const { convId, focus } = useLocalSearchParams<{ convId: string; focus?: string }>();
  const c = useConversationState(convId, focus);
  const { activeLine } = c;

  /** In-conversation local message search from the overflow menu: open swaps the topnav to the shared SearchTopnavBar with a results panel under it, driven by this query. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const closeSearch = useCallback(() => { setSearchOpen(false); setSearchQuery(''); }, []);
  /** Search opens from a native Modal that owns IME focus, so the keyboard won't attach; fix waits for the modal dismiss then blur()+focus() and retries until keyboardDidShow. */
  const searchInputRef = useSearchKeyboardFocus(searchOpen);

  /** Message-request gate: default to showing the composer (common accepted case, no flash) and only hide it for the Approve/Reject bar once consent resolves to a pending 'unknown' request. */
  const [requestPending, setRequestPending] = useState(false);
  const onRequestPending = useCallback((pending: boolean) => { setRequestPending(pending); }, []);

  /** Reactive archived flag so the overflow menu shows Unarchive immediately (the store loads async; a bare sync read can miss the first paint). */
  const archived = useArchivedFlag(convId);

  const insets = useSafeAreaInsets();
  /** Reanimated keyboard offset shared with the composer's KeyboardStickyView so the FlatList wrapper lifts in lockstep. Match the composer's `height - insets.bottom` translate (subtract insets.bottom too) or the feed overshoots. Clamp ≥0. */
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
      {/** Swipe-back handled by the @react-navigation/stack JS card stack (app/_layout): its left-edge rightward gesture pops + composes with the inverted FlatList scroll + leftward bubble swipe-to-reply. */}
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
      {/** Top nav: solid bg strip mirroring the composer footer and extending over the status bar; when search is open it swaps to the shared SearchTopnavBar with the results panel beneath. */}
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
      {/** Overlays — portals/bottom-sheets render here, outside the feed column. */}
      <ConversationOverlays
        c={c} convId={convId} dark={dark} archived={archived}
        onOpenSearch={() => { setSearchQuery(''); setSearchOpen(true); }}
/>
    </RNAnimated.View>
  );
}
