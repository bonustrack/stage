import { z } from 'zod';
import { defineSyncKind, inTime } from './kind';
import { CHANNEL_GROUP_KEYS, type ChannelGroupKey } from '../channelMeta';

function nonEmpty<T>(values: readonly T[]): readonly [T, ...T[]] {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('Channels need at least one group key');
  return [first, ...rest];
}

export const GROUP_KEYS = nonEmpty(CHANNEL_GROUP_KEYS);

export type GroupKey = ChannelGroupKey;

export const homeSortSchema = z.object({ by: z.enum(['status', 'created', 'updated', 'priority']), direction: z.enum(['asc', 'desc']) });

export type HomeSort = z.infer<typeof homeSortSchema>;

export const homeViewSchema = z.object({
  view: z.enum(['chats', 'board']),
  groupBy: z.enum(['none', ...GROUP_KEYS]),
  columnBy: z.enum(GROUP_KEYS).default('status'),
  chatsSort: homeSortSchema.optional(),
  boardSort: homeSortSchema.optional(),
  at: z.number().nonnegative(),
});

export type HomeViewContent = z.infer<typeof homeViewSchema>;

export type HomeViewEdit = Partial<Omit<HomeViewContent, 'at'>>;

export const DEFAULT_HOME_VIEW: HomeViewContent = { view: 'chats', groupBy: 'none', columnBy: 'status', at: 0 };

function newestFieldsFirst(states: readonly HomeViewContent[], maxAt: number): HomeViewContent | null {
  const newestFirst = inTime(states, maxAt).sort((a, b) => b.at - a.at);
  return newestFirst.reduce<HomeViewContent | null>((latest, state) => ({ ...state, ...latest }), null);
}

export const HOME_VIEW_SYNC = defineSyncKind({
  typeId: 'homeView',
  schema: homeViewSchema,
  fallback: 'Stage home view',
  replay: newestFieldsFirst,
});
