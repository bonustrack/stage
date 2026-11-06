import { z } from 'zod';
import { defineSyncKind, latestWins } from './kind';

export const searchStateSchema = z.object({
  query: z.string(),
  labels: z.array(z.string().min(1)),
  unreadOnly: z.boolean(),
  at: z.number().nonnegative(),
});

export type SearchStateContent = z.infer<typeof searchStateSchema>;

export const SEARCH_SYNC = defineSyncKind({
  typeId: 'searchState',
  schema: searchStateSchema,
  fallback: 'Stage search',
  replay: latestWins<SearchStateContent>(),
});
