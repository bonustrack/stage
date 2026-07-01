
import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue';
import { ConsentState, type Conversation } from '@xmtp/browser-sdk';
import {
  buildRequestsQueue, type QueuedRequest,
  type FeedRequestInput, type MessageRequestInput,
} from '@stage-labs/client/xmtp/requests-queue';
import { votesByMessage, ownVotesByMessage } from '@stage-labs/client/xmtp/poll-feed';
import type { PollContent } from '@stage-labs/client/xmtp/poll';
import type { WalletSendCallsContent } from '@stage-labs/client/xmtp/tx';
import type { SignatureRequestContent } from '@stage-labs/client/xmtp/sign';
import type { HistoryEntry } from '@stage-labs/client/types';
import { XMTP_USER_PREFIX, getOrCreateXmtpClient, getCachedXmtpClient, lineOfConv } from './xmtp';
import { envelopeOfXmtpMessage } from './xmtpEnvelope';
import { listRequestConvs } from './xmtpRequests';
import { isArchived } from './archived';
import { accountEpoch } from './accounts';

export interface PollDetail {
  poll: PollContent;
  line: string;
  votes: Map<number, Map<number, Set<string>>>;
  ownVotes: Map<number, Set<number>>;
}

export interface ProposalDetail {
  poll?: PollDetail;
  payment?: WalletSendCallsContent;
  signing?: SignatureRequestContent;
}

export interface ProposalsState {
  requests: Ref<QueuedRequest[] | null>;
  details: Ref<Map<string, ProposalDetail>>;
  loading: Ref<boolean>;
  error: Ref<string>;
  refresh: () => Promise<void>;
}

async function lastMessageTs(conv: Conversation): Promise<number> {
  const msgs = await conv.messages({ limit: 1n }).catch(() => []);
  const last = msgs[0];
  if (!last) return 0;
  const t = last.sentAt.getTime();
  return Number.isFinite(t) ? t : 0;
}

async function feedInputOf(conv: Conversation): Promise<FeedRequestInput | null> {
  if (isArchived(conv.id)) return null;
  try {
    const msgs = await conv.messages({ limit: 25n });
    const events = [...msgs].reverse().map(m => envelopeOfXmtpMessage(m, lineOfConv(conv.id)));
    return { convId: conv.id, events };
  } catch {
    return null;
  }
}

async function collectFeeds(): Promise<FeedRequestInput[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const convs = await client.conversations
    .list({ consentStates: [ConsentState.Allowed] })
    .catch(() => [] as Conversation[]);
  const inputs = await Promise.all(convs.map(feedInputOf));
  return inputs.filter((i): i is FeedRequestInput => i !== null);
}

async function collectMessageRequests(): Promise<MessageRequestInput[]> {
  const views = await listRequestConvs().catch(() => []);
  const client = getCachedXmtpClient();
  const out: MessageRequestInput[] = [];
  for (const view of views) {
    if (isArchived(view.convId)) continue;
    let ts = 0;
    const conv = await client?.conversations.getConversationById(view.convId).catch(() => undefined);
    if (conv) ts = await lastMessageTs(conv);
    out.push({ view, ts });
  }
  return out;
}

function pollDetailOf(events: HistoryEntry[], entry: HistoryEntry, line: string, myUri: string): PollDetail | null {
  const poll = (entry.payload as { poll?: PollContent } | undefined)?.poll;
  if (!poll) return null;
  const pollId = poll.pollId ?? entry.id;
  const emptyVotes = new Map<number, Map<number, Set<string>>>();
  const emptyOwn = new Map<number, Set<number>>();
  const votes = votesByMessage(events).get(pollId) ?? emptyVotes;
  const ownVotes = ownVotesByMessage(events, myUri).get(pollId) ?? emptyOwn;
  return { poll, line, votes, ownVotes };
}

function detailOfRequest(
  req: QueuedRequest, events: HistoryEntry[], entry: HistoryEntry, myUri: string,
): ProposalDetail | null {
  const payload = entry.payload as {
    walletSendCalls?: WalletSendCallsContent; signatureRequest?: SignatureRequestContent;
  } | undefined;
  if (req.kind === 'poll') {
    const poll = pollDetailOf(events, entry, lineOfConv(req.convId), myUri);
    return poll ? { poll } : null;
  }
  if (req.kind === 'payment' && payload?.walletSendCalls) return { payment: payload.walletSendCalls };
  if (req.kind === 'signing' && payload?.signatureRequest) return { signing: payload.signatureRequest };
  return null;
}

function buildDetails(
  queue: QueuedRequest[], feedEvents: Map<string, HistoryEntry[]>, myUri: string,
): Map<string, ProposalDetail> {
  const details = new Map<string, ProposalDetail>();
  for (const req of queue) {
    if (!req.msgId) continue;
    const events = feedEvents.get(req.convId) ?? [];
    const entry = events.find(e => e.id === req.msgId);
    if (!entry) continue;
    const detail = detailOfRequest(req, events, entry, myUri);
    if (detail) details.set(req.key, detail);
  }
  return details;
}

export function useProposals(): ProposalsState {
  const requests = ref<QueuedRequest[] | null>(null);
  const details = ref<Map<string, ProposalDetail>>(new Map());
  const loading = ref(false);
  const error = ref('');
  let token = 0;

  async function refresh(): Promise<void> {
    const mine = ++token;
    loading.value = true;
    error.value = '';
    try {
      const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
      const myUri = `${XMTP_USER_PREFIX}${client.inboxId ?? ''}`;
      const [feeds, messageRequests] = await Promise.all([collectFeeds(), collectMessageRequests()]);
      if (mine !== token) return;
      const queue = buildRequestsQueue({ feeds, messageRequests, myUri });
      const feedEvents = new Map(feeds.map(f => [f.convId, f.events]));
      requests.value = queue;
      details.value = buildDetails(queue, feedEvents, myUri);
    } catch (e) {
      if (mine !== token) return;
      error.value = (e as Error).message;
      requests.value = [];
      details.value = new Map();
    } finally {
      if (mine === token) loading.value = false;
    }
  }

  onMounted(() => { void refresh(); });
  const stop = watch(accountEpoch, () => { requests.value = null; void refresh(); });
  onUnmounted(() => { token += 1; stop(); });

  return { requests, details, loading, error, refresh };
}

export function useProposalCount(): { count: Ref<number> } {
  const { requests } = useProposals();
  const count = ref(0);
  watch(requests, (next) => { count.value = next?.length ?? 0; }, { immediate: true });
  return { count };
}
