import { SYNC_CODECS } from '@stage-labs/client/xmtp/jsonCodecs';
import type { SyncContents, SyncKind, SyncReplay } from '@stage-labs/client/xmtp/sync/registry';
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
  const codec = SYNC_CODECS[spec.kind];
  const publisher =
    (sink: SyncSink): Publish<SyncContents[K]> =>
    (job) => {
      sink.publish({
        key: job.key,
        ...(job.accountId === undefined ? {} : { accountId: job.accountId }),
        ...(job.delayMs === undefined ? {} : { delayMs: job.delayMs }),
        ...(job.durable === undefined ? {} : { durable: job.durable }),
        send: async () => {
          const content = await job.content();
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
