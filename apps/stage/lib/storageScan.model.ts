import type { MessageQuery } from './xmtp.sdk.core';
import {
  FILE_PAGE_SIZE, NO_FINDINGS, deletesToCheck, findingsOf, joinFindings, pageCursor,
  type ScanFindings, type ScannedMessage, type StorageIndex,
} from './storageIndex.model';

export class ScanStopped extends Error {
  constructor() { super('Storage scan stopped'); }
}

export interface ScanSource<C> {
  page: (conv: C, query: MessageQuery) => Promise<ScannedMessage[]>;
  skip: (conv: C) => Promise<boolean>;
  superAdmins: (conv: C) => Promise<ReadonlySet<string>>;
  current: () => boolean;
  failed: (err: unknown) => void;
}

export interface ScanSink {
  index: () => StorageIndex;
  apply: (findings: Pick<ScanFindings, 'files' | 'deletedIds'>) => void;
  progress: (done: number, total: number) => void;
}

export function scanQuery(sinceNs: number, beforeNs: number | undefined): MessageQuery {
  return {
    limit: FILE_PAGE_SIZE, order: 'desc', filesOnly: true,
    ...(sinceNs > 0 ? { insertedAfterNs: sinceNs } : {}),
    ...(beforeNs === undefined ? {} : { beforeNs }),
  };
}

async function conversationFindings<C>(
  conv: C, sinceNs: number, selfInboxId: string, source: ScanSource<C>,
): Promise<ScanFindings> {
  if (await source.skip(conv)) return NO_FINDINGS;
  const seen = new Set<string>();
  let findings = NO_FINDINGS;
  let beforeNs: number | undefined;
  for (;;) {
    const page = await source.page(conv, scanQuery(sinceNs, beforeNs));
    if (!source.current()) throw new ScanStopped();
    const fresh = page.filter(m => !seen.has(m.id));
    for (const m of fresh) seen.add(m.id);
    findings = joinFindings(findings, findingsOf(fresh, selfInboxId));
    if (page.length < FILE_PAGE_SIZE || fresh.length === 0) return findings;
    beforeNs = pageCursor(page);
  }
}

async function settledFindings<C>(
  conv: C, index: StorageIndex, findings: ScanFindings, source: ScanSource<C>,
): Promise<Pick<ScanFindings, 'files' | 'deletedIds'>> {
  const toCheck = deletesToCheck(index, findings);
  if (toCheck.length === 0) return findings;
  const supers = await source.superAdmins(conv);
  const allowed = toCheck.filter(d => supers.has(d.by.toLowerCase())).map(d => d.target);
  return { files: findings.files, deletedIds: [...findings.deletedIds, ...allowed] };
}

async function scanOne<C>(conv: C, sinceNs: number, source: ScanSource<C>, sink: ScanSink): Promise<boolean> {
  try {
    const findings = await conversationFindings(conv, sinceNs, sink.index().inboxId, source);
    const settled = await settledFindings(conv, sink.index(), findings, source);
    if (!source.current()) throw new ScanStopped();
    sink.apply(settled);
    return true;
  } catch (err) {
    if (err instanceof ScanStopped) throw err;
    source.failed(err);
    return false;
  }
}

export async function scanConversations<C>(
  convs: readonly C[], sinceNs: number, source: ScanSource<C>, sink: ScanSink,
): Promise<boolean> {
  let complete = true;
  for (const [i, conv] of convs.entries()) {
    if (!await scanOne(conv, sinceNs, source, sink)) complete = false;
    sink.progress(i + 1, convs.length);
  }
  return complete;
}
