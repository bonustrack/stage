import { useQuery } from '@tanstack/react-query';
import type { HistoryEntry } from '@stage-labs/client/types';
import { isDeletedPlaceholderType } from '@stage-labs/client/xmtp/deleteMessage';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { frameIsDeleted, frameOf } from '../components/frame/frame.model';
import { useAccountEpoch } from './accountEpoch';
import { recover } from './errorPolicy';
import { ownDeletesReady } from './ownDeletes';
import { convOfLine, sdk } from './xmtp.sdk';

export type FrameMessage = { state: 'ready'; frame: FrameContent } | { state: 'missing' } | { state: 'deleted' };

const MISSING: FrameMessage = { state: 'missing' };
const DELETED: FrameMessage = { state: 'deleted' };
const MISSING_RECHECK_MS = 15_000;
const READY_STALE_MS = 60_000;
const DELETE_SCAN_LIMIT = 500;

async function deletedLater(line: string, entry: HistoryEntry, sentNs: number): Promise<boolean> {
  const conv = await convOfLine(line);
  if (!conv) return false;
  const later = await sdk.messages(conv, { limit: DELETE_SCAN_LIMIT, afterNs: sentNs, order: 'asc' });
  return frameIsDeleted(entry, later.map(m => sdk.envelopeOf(m, line)), await ownDeletesReady());
}

async function inChat(client: Awaited<ReturnType<typeof sdk.client>>, own: string | null | undefined, convId: string): Promise<boolean> {
  if (!own) return false;
  if (own === convId) return true;
  const [mine, shown] = await Promise.all([sdk.findConv(client, own), sdk.findConv(client, convId)]);
  if (!mine || !shown) return false;
  if (mine.id === shown.id) return true;
  const minePeer = sdk.dmPeerInboxId(mine);
  const shownPeer = sdk.dmPeerInboxId(shown);
  return minePeer !== null && shownPeer !== null && await minePeer() === await shownPeer();
}

async function loadFrameMessage(convId: string, messageId: string): Promise<FrameMessage> {
  const client = await sdk.client();
  const message = await sdk.messageById(client, messageId);
  if (!message || !await inChat(client, sdk.convIdOf(message), convId)) return MISSING;
  if (isDeletedPlaceholderType(sdk.rowOf(message).contentTypeId)) return DELETED;
  const line = lineOfConv(convId);
  const entry = sdk.envelopeOf(message, line);
  const frame = frameOf(entry);
  if (frame === null) return MISSING;
  return await deletedLater(line, entry, sdk.sentNsOf(message)) ? DELETED : { state: 'ready', frame };
}

export function useFrameMessage(convId: string, messageId: string, enabled = true): FrameMessage | undefined {
  const epoch = useAccountEpoch();
  const { data } = useQuery({
    queryKey: ['frameMessage', epoch, convId, messageId],
    queryFn: () => loadFrameMessage(convId, messageId).catch(recover('frame.message', MISSING)),
    enabled,
    staleTime: READY_STALE_MS,
    retry: false,
    refetchInterval: query => (query.state.data?.state === 'missing' ? MISSING_RECHECK_MS : false),
  });
  return data;
}
