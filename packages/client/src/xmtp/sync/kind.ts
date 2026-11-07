import type { OutputSchema } from '../../validate';
import { jsonCodec, type JsonCodec } from '../jsonCodec';
import { shortTypeId } from '../typeId';

export interface SyncMessage {
  contentTypeId: string | undefined;
  content: unknown;
  senderInboxId: string;
  sentNs: number;
}

export interface SyncKindDef<T, R> extends JsonCodec<T> {
  schema: OutputSchema<T>;
  matches: (contentTypeId: string | undefined) => boolean;
  collect: (messages: readonly SyncMessage[], maxAt: number) => R;
}

interface SyncKindSpec<T, R> {
  typeId: string;
  schema: OutputSchema<T>;
  fallback: string;
  replay: (states: readonly T[], maxAt: number) => R;
}

export function defineSyncKind<T, R>(spec: SyncKindSpec<T, R>): SyncKindDef<T, R> {
  const contentType = { authorityId: 'stage.box', typeId: spec.typeId, versionMajor: 1, versionMinor: 0 };
  const matches = (contentTypeId: string | undefined): boolean => shortTypeId(contentTypeId) === spec.typeId;
  const stateOf = (message: SyncMessage): T[] => {
    if (!matches(message.contentTypeId)) return [];
    const parsed = spec.schema.safeParse(message.content);
    return parsed.success ? [parsed.data] : [];
  };
  return {
    ...jsonCodec(contentType, () => spec.fallback, spec.schema, undefined, false),
    schema: spec.schema,
    matches,
    collect: (messages, maxAt) => spec.replay(messages.flatMap(stateOf), maxAt),
  };
}

export function isNewerSyncState(localAt: number | undefined, incomingAt: number): boolean {
  return localAt === undefined || incomingAt > localAt;
}

export function inTime<T extends { at: number }>(states: readonly T[], maxAt: number): T[] {
  return states.filter((state) => state.at <= maxAt);
}

function newer<T extends { at: number }>(current: T, incoming: T): T {
  return incoming.at > current.at ? incoming : current;
}

export function latestWins<T extends { at: number }>(
  merge: (current: T, incoming: T) => T = newer,
): (states: readonly T[], maxAt: number) => T | null {
  return (states, maxAt) =>
    inTime(states, maxAt).reduce<T | null>((latest, state) => (latest === null ? state : merge(latest, state)), null);
}
