
import type { HistoryEntry } from '../types';
import { normalizeQuestions, type PollContent } from './poll';
import { ownVotes, type VoteEvent } from './poll-tally';
import type { WalletSendCallsContent } from './tx';
import type { SignatureRequestContent } from './sign';
import type { ConversationRequestView } from './request';

export type RequestKind = 'poll' | 'payment' | 'signing' | 'message';

export interface QueuedRequest {
  key: string;
  kind: RequestKind;
  convId: string;
  msgId?: string;
  request?: ConversationRequestView;
  ts: number;
}

interface PollPayload { contentType?: string; poll?: PollContent }
interface TxPayload { contentType?: string; walletSendCalls?: WalletSendCallsContent }
interface SigPayload { contentType?: string; signatureRequest?: SignatureRequestContent }
interface VotePayload { reactTo?: string; emoji?: string; removed?: boolean; schema?: string }

function entryTs(entry: HistoryEntry): number {
  const t = entry.ts ? new Date(entry.ts).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function pollOf(entry: HistoryEntry): PollContent | undefined {
  const p = entry.payload as PollPayload | undefined;
  if (p?.contentType !== 'poll' || !p.poll) return undefined;
  return p.poll;
}

function txRequestOf(entry: HistoryEntry): WalletSendCallsContent | undefined {
  const p = entry.payload as TxPayload | undefined;
  const wsc = p?.walletSendCalls;
  if (!wsc || !Array.isArray(wsc.calls)) return undefined;
  return wsc;
}

function sigRequestOf(entry: HistoryEntry): SignatureRequestContent | undefined {
  const p = entry.payload as SigPayload | undefined;
  if (!p?.signatureRequest?.kind) return undefined;
  return p.signatureRequest;
}

function voteEventsOf(events: HistoryEntry[]): VoteEvent[] {
  const out: VoteEvent[] = [];
  for (const e of events) {
    const p = e.payload as VotePayload | undefined;
    if (p?.schema !== 'custom' || !p.reactTo || p.emoji === undefined) continue;
    out.push({
      reference: p.reactTo, content: p.emoji, schema: 'custom',
      removed: !!p.removed, voter: e.from, ts: e.ts,
    });
  }
  return out;
}

function pollAwaitingVote(poll: PollContent, pollMsgId: string, events: HistoryEntry[], myUri: string): boolean {
  const questions = normalizeQuestions(poll);
  if (questions.length === 0) return false;
  const pollId = poll.pollId ?? pollMsgId;
  const votes = voteEventsOf(events);
  return questions.some((q, qi) =>
    ownVotes(votes, myUri, pollId, q.multiSelect === true, qi).size === 0);
}

export interface FeedRequestInput {
  convId: string;
  events: HistoryEntry[];
}

function detectInFeed(input: FeedRequestInput, myUri: string): QueuedRequest | null {
  const latest = input.events[0];
  if (!latest) return null;
  const ts = entryTs(latest);
  const poll = pollOf(latest);
  if (poll) {
    if (!pollAwaitingVote(poll, latest.id, input.events, myUri)) return null;
    return { key: `poll:${input.convId}`, kind: 'poll', convId: input.convId, msgId: latest.id, ts };
  }
  if (txRequestOf(latest)) {
    return { key: `payment:${input.convId}`, kind: 'payment', convId: input.convId, msgId: latest.id, ts };
  }
  if (sigRequestOf(latest)) {
    return { key: `signing:${input.convId}`, kind: 'signing', convId: input.convId, msgId: latest.id, ts };
  }
  return null;
}

export interface MessageRequestInput {
  view: ConversationRequestView;
  ts: number;
}

export interface BuildRequestsQueueInput {
  feeds: FeedRequestInput[];
  messageRequests: MessageRequestInput[];
  myUri: string;
}

export function buildRequestsQueue(input: BuildRequestsQueueInput): QueuedRequest[] {
  const detected: QueuedRequest[] = [];
  for (const feed of input.feeds) {
    const item = detectInFeed(feed, input.myUri);
    if (item) detected.push(item);
  }
  const messages: QueuedRequest[] = input.messageRequests.map(m => ({
    key: `message:${m.view.convId}`,
    kind: 'message',
    convId: m.view.convId,
    request: m.view,
    ts: m.ts,
  }));
  return [...detected, ...messages].sort((a, b) => b.ts - a.ts);
}
