
import {
  loadFeedFirstPage, lineOfConv, listRequestConvs,
  summarizeConversationRequest, type CachedRow,
} from '../../modules/messaging';
import { pollOf, txRequestOf, sigRequestOf } from '../MessengerBubble.helpers';
import { isArchived } from '../../lib/archived';
import {
  detectFeedRequest, assembleRequestsQueue, messageRequestToQueued,
  type FeedDetectors, type QueuedRequest, type RequestKind,
} from '@stage-labs/client/xmtp/requests-queue';

export type { RequestKind, QueuedRequest };

const detectors: FeedDetectors = {
  hasPoll: (latest) => pollOf(latest) !== undefined,
  hasTxRequest: (latest) => txRequestOf(latest) !== undefined,
  hasSigRequest: (latest) => sigRequestOf(latest) !== undefined,
};

async function detectOne(convId: string): Promise<QueuedRequest | null> {
  try {
    const events = await loadFeedFirstPage(lineOfConv(convId));
    return detectFeedRequest({ convId, events }, '', { detectors, filterVotedPolls: false });
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      if (item === undefined) continue;
      out[idx] = await fn(item);
    }
  });
  await Promise.all(workers);
  return out;
}

async function detectMessageRequests(): Promise<QueuedRequest[]> {
  try {
    const convs = await listRequestConvs();
    const summarized = await Promise.all(convs.map(async (conv): Promise<QueuedRequest | null> => {
      try {
        const view = await summarizeConversationRequest(conv);
        const ts = await requestTs(conv);
        return messageRequestToQueued({ view, ts });
      } catch {
        return null;
      }
    }));
    return summarized.filter((r): r is QueuedRequest => r !== null);
  } catch {
    return [];
  }
}

async function requestTs(conv: unknown): Promise<number> {
  try {
    const last = await (conv as { lastMessage?: () => Promise<{ sentAtNs?: number } | null> }).lastMessage?.();
    const ns = last?.sentAtNs;
    if (typeof ns === 'number' && ns > 0) return Math.floor(ns / 1_000_000);
  } catch { }
  return 0;
}

export async function buildProposalQueue(rows: CachedRow[]): Promise<QueuedRequest[]> {
  const candidates = rows.map(r => r.convId).filter(id => !isArchived(id));
  const [detected, messageReqs] = await Promise.all([
    mapLimit(candidates, 6, detectOne),
    detectMessageRequests(),
  ]);
  return assembleRequestsQueue(
    detected.filter((p): p is QueuedRequest => p !== null),
    messageReqs,
  );
}
