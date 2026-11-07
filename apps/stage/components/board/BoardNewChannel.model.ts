import { isSyncGroupName, type GroupKey } from '@stage-labs/client/xmtp/readState';
import { channelDraftProblem } from '../channel/EditChannelModal.model';
import { groupedChatMetadata, newChatAppData, type NewChatMetadata } from '../home/newChatMetadata.model';

export interface BoardPendingChannel {
  id: number;
  name: string;
  members: string[];
  appData: string | undefined;
  existingIds: ReadonlySet<string>;
  convId: string | null;
  error: string | null;
}

export interface BoardChannelCreations {
  pending: BoardPendingChannel[];
  createdIds: ReadonlySet<string>;
}

type CreationEvent =
  | { type: 'submit'; pending: BoardPendingChannel }
  | { type: 'created'; id: number; convId: string }
  | { type: 'failed'; id: number; error: string }
  | { type: 'retry'; id: number; existingIds: ReadonlySet<string> }
  | { type: 'dismiss'; id: number }
  | { type: 'confirm'; ids: ReadonlySet<string> };

interface PendingRow extends NewChatMetadata {
  convId: string;
  groupName?: string;
  peerAddress: string | null;
  priority: string | null;
}

export function boardChannelCreations(state: BoardChannelCreations, event: CreationEvent): BoardChannelCreations {
  switch (event.type) {
    case 'submit':
      return { ...state, pending: [event.pending, ...state.pending] };
    case 'created':
      return {
        createdIds: new Set([...state.createdIds, event.convId]),
        pending: state.pending.map((p) => (p.id === event.id ? { ...p, convId: event.convId, error: null } : p)),
      };
    case 'failed':
      return { ...state, pending: state.pending.map((p) => (p.id === event.id ? { ...p, error: event.error } : p)) };
    case 'retry':
      return {
        ...state,
        pending: state.pending.map((p) =>
          p.id === event.id && p.error !== null ? { ...p, error: null, existingIds: new Set([...p.existingIds, ...event.existingIds]) } : p,
        ),
      };
    case 'dismiss':
      return { ...state, pending: state.pending.filter((p) => p.id !== event.id || p.error === null) };
    case 'confirm': {
      const pending = state.pending.filter((p) => p.convId === null || !event.ids.has(p.convId));
      return pending.length === state.pending.length ? state : { ...state, pending };
    }
  }
}

function matchesPending(row: PendingRow, pending: BoardPendingChannel): boolean {
  return (
    pending.error === null &&
    pending.convId === null &&
    !pending.existingIds.has(row.convId) &&
    row.peerAddress === null &&
    row.groupName === pending.name &&
    row.priority === null &&
    newChatAppData(row) === pending.appData
  );
}

export function boardChannelRows<T extends PendingRow>(rows: T[], state: BoardChannelCreations): T[] {
  if (state.pending.length === 0) return rows;
  return rows.filter((row) => state.createdIds.has(row.convId) || !state.pending.some((pending) => matchesPending(row, pending)));
}

export function boardChannelNameProblem(name: string): string | null {
  if (name.trim() === '') return 'Enter a channel name.';
  if (isSyncGroupName(name.trim())) return 'Choose another channel name.';
  return channelDraftProblem({ name: null, description: '' }, { name, description: '' });
}

export function boardChannelDraft(by: GroupKey, key: string, title: string, name: string, self: string) {
  const metadata = groupedChatMetadata(by, key, title);
  return { name: name.trim(), members: metadata.assigned.length > 0 ? metadata.assigned : [self], appData: newChatAppData(metadata) };
}
