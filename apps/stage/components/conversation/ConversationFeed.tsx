import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { ConversationIntro } from './ConversationIntro';
import { feedOrientation } from './feedOrientation';
import { useFeedRenderItem, type BubbleFeed } from './useFeedRenderItem';
import type { ConvSummary, FeedSlice } from './useConversationState';
import { usePalette } from '../../lib/theme';
import { useSafeAreaInsets } from '../layout/safeArea';
import { TOPNAV_HEIGHT } from '../Topnav';
import { ChatGalleryProvider } from '../media/ChatGallery';
import { useChatColumnFill } from './FooterDock';
import { RetryNotice } from '../chrome/RetryNotice';
import { Column, VirtualList } from '../layout';

const FEED_ESTIMATED_ROW = 80;

function FeedOlderEdge({
  loading,
  sub,
  hasMore,
  intro,
}: {
  loading: boolean;
  sub: string;
  hasMore: boolean;
  intro: React.ReactElement;
}): React.ReactElement {
  return (
    <>
      {loading ? (
        <Column padding={{ y: 16 }} align="center">
          <Spinner size={20} color={sub} />
        </Column>
      ) : null}
      {!hasMore ? intro : null}
    </>
  );
}

const LOADER_DELAY_MS = 180;
let feedShownOnce = false;

function useSlowOpen(waiting: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) {
      feedShownOnce = true;
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => {
      setSlow(true);
    }, LOADER_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [waiting]);
  return slow || !feedShownOnce;
}

function FeedPending({
  failed,
  slow,
  color,
  style,
  onRetry,
}: {
  failed: boolean;
  slow: boolean;
  color: string;
  style: ReturnType<typeof useChatColumnFill>;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <Column weight={1} align="center" justify="center" style={style}>
      {failed ? <RetryNotice message="Could not load messages." onRetry={onRetry} /> : slow ? <Spinner size={28} color={color} /> : null}
    </Column>
  );
}

export function ConversationFeed({
  feed,
  bubbles,
  conv,
  convId,
  bottomInset = 0,
  searchSlot,
}: {
  feed: FeedSlice;
  bubbles: BubbleFeed;
  conv: ConvSummary;
  convId: string;
  bottomInset?: number;
  searchSlot?: React.ReactNode;
}): React.ReactElement {
  const { hasMore, loadingOlder, status, scroll, bubbles: allBubbles } = feed;
  const { text: sub, link: head } = usePalette();
  const topPad = useSafeAreaInsets().top + TOPNAV_HEIGHT;
  const { renderItem, extraData } = useFeedRenderItem(bubbles, allBubbles);
  const intro = <ConversationIntro conv={conv} convId={convId} />;
  const rows = useMemo(() => feedOrientation.rows(allBubbles), [allBubbles]);
  const empty = rows.length === 0 && (status !== 'open' || hasMore);
  const slowOpen = useSlowOpen(empty);
  const loaderFill = useChatColumnFill(bottomInset);

  if (searchSlot !== undefined) {
    return (
      <Column weight={1} padding={{ top: topPad }}>
        {searchSlot}
      </Column>
    );
  }

  if (empty) {
    return <FeedPending failed={status === 'error'} slow={slowOpen} color={head} style={loaderFill} onRetry={feed.retryFeed} />;
  }

  const olderEdge = <FeedOlderEdge loading={loadingOlder && scroll.showJump} sub={sub} hasMore={hasMore} intro={intro} />;
  const o = feedOrientation.orient(scroll.pageOlder, topPad + 24, 24 + bottomInset, olderEdge);

  return (
    <ChatGalleryProvider entries={allBubbles}>
      <VirtualList
        key={convId}
        ref={scroll.listRef}
        data={rows}
        extraData={extraData}
        inverted={o.inverted}
        anchor={feedOrientation.listAnchor}
        stickToEnd={scroll.stickToNewest}
        estimatedItemSize={FEED_ESTIMATED_ROW}
        maintainVisibleContentPosition={feedOrientation.positionHold(scroll.showJump)}
        keyExtractor={feed.rowKeyOf}
        windowSize={11}
        initialNumToRender={feedOrientation.firstBatch(rows.length)}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        onEndReached={o.onEndReached}
        onEndReachedThreshold={0.5}
        onStartReached={o.onStartReached}
        onStartReachedThreshold={0.5}
        contentContainerStyle={o.contentPadding}
        {...scroll.feedListEvents}
        scrollEventThrottle={16}
        onScrollToIndexFailed={() => undefined}
        renderItem={renderItem}
        ListHeaderComponent={o.header}
        ListFooterComponent={o.footer}
        keyboardShouldPersistTaps="handled"
      />
    </ChatGalleryProvider>
  );
}
