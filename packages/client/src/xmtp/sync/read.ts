import { z } from 'zod';
import { defineSyncKind, inTime } from './kind';

const readStateSchema = z.object({
  convId: z.string().min(1),
  lastReadNs: z.number().nonnegative(),
  markedUnread: z.boolean(),
  at: z.number().positive(),
});

export type ReadStateContent = z.infer<typeof readStateSchema>;

function latestPerConversation(states: readonly ReadStateContent[], maxAt: number): ReadStateContent[] {
  const byConv = new Map<string, ReadStateContent>();
  for (const state of inTime(states, maxAt)) {
    const current = byConv.get(state.convId);
    if (current === undefined || state.at > current.at) byConv.set(state.convId, state);
  }
  return [...byConv.values()];
}

export const READ_SYNC = defineSyncKind({
  typeId: 'readState',
  schema: readStateSchema,
  fallback: 'Stage read state',
  replay: latestPerConversation,
});
