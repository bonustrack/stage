import { useCallback, useMemo, useRef } from 'react';
import type { HistoryEntry } from '@stage-labs/client/types';
import { MessengerBubble } from '../bubble/MessengerBubble';
import { BubbleErrorBoundary } from '../bubble/boundary';
import type { BubbleModel, FeedActions } from '../bubble/model';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { bubbleModelOf, reconcileBubbleModels, type BubbleFeedState } from './bubbleModels';

export interface BubbleFeed {
  state: BubbleFeedState;
  actions: FeedActions;
}

type RenderItem = ({ item }: { item: HistoryEntry }) => React.ReactElement;

function useBubbleModels(
  feed: BubbleFeed,
  entries: readonly HistoryEntry[],
  highlight: string | undefined,
): ReadonlyMap<string, BubbleModel> {
  const dark = useEffectiveColorScheme() === 'dark';
  const previous = useRef<ReadonlyMap<string, BubbleModel>>(new Map());
  const models = useMemo(() => {
    const view = { dark, highlight };
    return reconcileBubbleModels(previous.current, entries, (item) => bubbleModelOf(item, feed.state, view));
  }, [feed.state, entries, dark, highlight]);
  previous.current = models;
  return models;
}

export function useFeedRenderItem(
  feed: BubbleFeed,
  entries: readonly HistoryEntry[],
  highlight?: string,
): { renderItem: RenderItem; extraData: ReadonlyMap<string, BubbleModel> } {
  const sub = usePalette().text;
  const models = useBubbleModels(feed, entries, highlight);
  const { actions, state } = feed;
  const dark = useEffectiveColorScheme() === 'dark';
  const renderItem = useCallback(
    ({ item }: { item: HistoryEntry }) => (
      <BubbleErrorBoundary sub={sub} entry={item}>
        <MessengerBubble model={models.get(item.id) ?? bubbleModelOf(item, state, { dark, highlight })} actions={actions} />
      </BubbleErrorBoundary>
    ),
    [sub, models, actions, state, dark, highlight],
  );
  return { renderItem, extraData: models };
}
