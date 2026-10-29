import { createContext, useSyncExternalStore, type ReactNode } from 'react';
import type { PanGesture } from 'react-native-gesture-handler';
import type { SortDirection } from '../sortable';
import type { SortCoordinator, SortIndicator, SortItemEntry, SortState } from './sortable.store';

export type SortTouchAction = 'manipulation' | 'pan-x' | 'pan-y';

export interface ListContextValue {
  coordinator: SortCoordinator;
  listId: string;
  group: string;
  direction: SortDirection;
  disabled: boolean;
  keyboard: boolean;
  indicator: SortIndicator;
  touchAction: SortTouchAction;
  items: Map<string, SortItemEntry>;
}

export interface HandleValue {
  pan: PanGesture;
  list: ListContextValue;
  itemId: string;
  enabled: boolean;
  preview: () => ReactNode;
}

export const ScopeContext = createContext<SortCoordinator | null>(null);
export const PreviewContext = createContext(false);
export const ListContext = createContext<ListContextValue | null>(null);
export const ListsContext = createContext<ReadonlyMap<string, ListContextValue>>(new Map());
export const HandleContext = createContext<HandleValue | null>(null);

export function isInPlace(indicator: SortIndicator): boolean {
  return indicator === 'shift' || indicator === 'follow';
}

export function useSortState<T>(coordinator: SortCoordinator, select: (state: SortState) => T): T {
  return useSyncExternalStore(
    coordinator.subscribe,
    () => select(coordinator.state()),
    () => select(coordinator.state()),
  );
}
