import type { ReactElement, RefObject } from 'react';
import type { ViewStyle } from 'react-native';
import type { FeedAnchor } from '../../lib/scrollPos';
import type { VirtualListHandle } from '../layout/VirtualList.types';

export const FOLLOW_NEWEST_WITHIN_PX = 24;

export const FEED_MIN_BATCH = 12;

export interface FeedScrollMetrics {
  offset: number;
  contentHeight: number;
  viewportHeight: number;
}

export interface FeedScrollState {
  list: RefObject<VirtualListHandle | null>;
  savedDistance: number | undefined;
  savedAnchor: FeedAnchor | null;
  savedLoaded: boolean;
  restored: boolean;
  pinUntil: number;
  atNewest: boolean;
  viewportHeight: number;
  userDragged: boolean;
  metrics: FeedScrollMetrics;
  positioned: boolean;
  settleUntil: number;
  olderPending: boolean;
}

export interface FeedPositionHold {
  minIndexForVisible: number;
  autoscrollToTopThreshold?: number;
}

export interface OrientedFeed {
  inverted: boolean;
  onStartReached?: () => void;
  onEndReached?: () => void;
  contentPadding: ViewStyle;
  header?: ReactElement;
  footer?: ReactElement;
}

export interface FeedOrientation {
  listAnchor: 'start' | 'end';
  measuresViewportOnLayout: boolean;
  keepsAnchor: boolean;
  rows<T>(newestFirst: readonly T[]): readonly T[];
  rowIndexOf(newestFirstIndex: number, count: number): number;
  firstBatch(rowCount: number): number;
  distanceFromNewest(m: FeedScrollMetrics): number;
  positionHold(awayFromNewest: boolean): FeedPositionHold | undefined;
  orient(loadOlder: () => void, headPad: number, footPad: number, olderEdge: ReactElement): OrientedFeed;
  defersOlderPage(m: FeedScrollMetrics, positioned: boolean): boolean;
  settling(s: FeedScrollState, now: number): boolean;
  restore(s: FeedScrollState, contentHeight: number, itemCount: number): number | null;
  scrollToNewest(list: VirtualListHandle | null): void;
}
