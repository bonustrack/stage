import { syncCodecOf, type SyncContents, type SyncKind, type SyncReplay } from '@stage-labs/client/xmtp/sync/registry';
import { sendSyncState, type SyncTarget } from './group';
import type { SyncJob } from './publisher';
import { SHARED_CURSOR, type SyncCursor } from './replay';

export interface SyncSink {
  publish: (job: SyncJob) => void;
  withGroup: (send: (target: SyncTarget) => Promise<unknown>, accountId?: string) => Promise<void>;
}

export interface KindJob<T> {
  key: string;
  accountId?: string;
  delayMs?: number;
  durable?: boolean;
  content: () => Promise<T | null>;
}

type Publish<T> = (job: KindJob<T>) => void;

interface KindSpec<K extends SyncKind> {
  kind: K;
  cursor?: SyncCursor;
  watch: (publish: Publish<SyncContents[K]>) => void;
  apply: (accountId: string, replay: SyncReplay) => Promise<void>;
  snapshot?: (accountId: string) => Promise<SyncContents[K] | null>;
  republish?: (publish: Publish<SyncContents[K]>, accountId: string) => void;
}

export interface AppSyncKind {
  kind: SyncKind;
  cursor: SyncCursor;
  watch: (sink: SyncSink) => void;
  apply: (accountId: string, replay: SyncReplay) => Promise<void>;
  snapshot: (target: SyncTarget, accountId: string) => Promise<void>;
  republish: (sink: SyncSink, accountId: string) => void;
}

export function defineAppSyncKind<K extends SyncKind>(spec: KindSpec<K>): AppSyncKind {
  const codec = syncCodecOf(spec.kind);
  const publisher =
    (sink: SyncSink): Publish<SyncContents[K]> =>
    ({ content: read, ...job }) => {
      sink.publish({
        ...job,
        send: async () => {
          const content = await read();
          if (content !== null) await sink.withGroup((target) => sendSyncState(target, codec, content), job.accountId);
        },
      });
    };
  return {
    kind: spec.kind,
    cursor: spec.cursor ?? SHARED_CURSOR,
    watch: (sink) => {
      spec.watch(publisher(sink));
    },
    apply: spec.apply,
    snapshot: async (target, accountId) => {
      const content = spec.snapshot ? await spec.snapshot(accountId) : null;
      if (content !== null) await sendSyncState(target, codec, content);
    },
    republish: (sink, accountId) => {
      spec.republish?.(publisher(sink), accountId);
    },
  };
}
