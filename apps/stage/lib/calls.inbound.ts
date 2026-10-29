import {
  isCallInviteType,
  isCallSignalType,
  parseCallInvite,
  parseCallSignal,
  type CallInvite,
  type CallSignal,
} from '@stage-labs/client/xmtp/call';
import type { CallEvent } from '@stage-labs/client/xmtp/callMachine';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { convOfLine, sdk } from './xmtp.sdk';
import { afterFirstPages } from './feedLines';
import type { StreamMsg } from './xmtp.types';
import { reported } from './errorPolicy';

const HISTORY_LIMIT = 100;
const SEEN_MAX = 2_000;
interface CallContent {
  invite: CallInvite | null;
  signal: CallSignal | null;
}
interface CallInboundDeps {
  generation: () => number;
  selfInboxId: (epoch: number) => Promise<string>;
  dispatch: (event: CallEvent) => void;
}
interface CallInbound {
  onMessage: (message: StreamMsg) => void;
  reload: (convId: string) => Promise<void>;
  reset: () => void;
}

async function convContext(convId: string): Promise<{ dm: boolean; allowed: boolean }> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return { dm: false, allowed: false };
  return { dm: !sdk.isGroup(conv), allowed: (await sdk.consentOf(conv)) === 'allowed' };
}
function callContentOf(m: StreamMsg['msg']): CallContent | null {
  const invite = isCallInviteType(m.contentTypeId) ? parseCallInvite(m.content) : null;
  const signal = isCallSignalType(m.contentTypeId) ? parseCallSignal(m.content) : null;
  return invite || signal ? { invite, signal } : null;
}
export function makeCallInbound({ generation, selfInboxId, dispatch }: CallInboundDeps): CallInbound {
  const seen = new Set<string>();
  const histories = new Map<string, Promise<void>>();
  let ingestQueue: Promise<void> = Promise.resolve();
  async function ingest(convId: string, m: StreamMsg['msg'], { invite, signal }: CallContent, epoch: number): Promise<void> {
    const base = {
      convId,
      senderInboxId: m.senderInboxId,
      selfInboxId: await selfInboxId(epoch),
      sentMs: Math.floor(m.sentNs / 1_000_000),
      nowMs: Date.now(),
    };
    if (generation() !== epoch) return;
    if (signal) dispatch({ ...base, type: 'signal', signal });
    if (invite) {
      const context = await convContext(convId);
      if (generation() === epoch) dispatch({ ...base, type: 'invite', invite, ...context });
    }
  }
  function firstSight(id: string): boolean {
    if (seen.has(id)) return false;
    seen.add(id);
    if (seen.size > SEEN_MAX) {
      const oldest = seen.values().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    return true;
  }
  function enqueue(convId: string, m: StreamMsg['msg'], epoch: number): void {
    const call = callContentOf(m);
    if (generation() !== epoch || !call || !firstSight(m.id)) return;
    ingestQueue = ingestQueue.then(() => ingest(convId, m, call, epoch)).catch(reported('calls.ingest'));
  }
  async function replayHistory(convId: string, epoch: number): Promise<void> {
    await afterFirstPages();
    const conv = await convOfLine(lineOfConv(convId));
    if (!conv) return;
    const recent = await sdk.messages(conv, { limit: HISTORY_LIMIT, order: 'desc' });
    for (const m of recent.reverse()) enqueue(convId, sdk.rowOf(m), epoch);
  }
  function historyOf(convId: string): Promise<void> {
    const known = histories.get(convId);
    if (known) return known;
    const ready = replayHistory(convId, generation()).catch(reported('calls.history'));
    histories.set(convId, ready);
    return ready;
  }
  return {
    onMessage: ({ convId, msg }) => {
      if (!convId || !callContentOf(msg)) return;
      const epoch = generation();
      void historyOf(convId).then(() => {
        enqueue(convId, msg, epoch);
      });
    },
    reload: (convId) => {
      histories.delete(convId);
      return historyOf(convId);
    },
    reset: () => {
      seen.clear();
      histories.clear();
    },
  };
}
