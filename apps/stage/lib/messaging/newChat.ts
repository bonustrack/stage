import { useEffect, useState } from 'react';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { createValueStore } from '../persistedStore';
import { reported } from '../errorPolicy';
import { createGroup } from '../xmtp.groups';
import { getConvConsentState } from '../xmtp.conv';
import { uploadAttachments } from '../xmtp.attachments';
import { schedulePushTopicRefresh } from '../pushRegister';
import type { LocalAttachmentInput } from '../xmtp.types';
import { NO_MEMBER_HISTORY, memberHistorySchema, startedChatWith, type MemberHistory } from './newChatMembers.model';

const NEW_CHANNEL_PUSH_REFRESH_MS = 10_000;
const NO_REQUESTS: ReadonlySet<string> = new Set();

const memberHistory = createValueStore<MemberHistory>({
  key: 'new-chat.members.',
  default: NO_MEMBER_HISTORY,
  schema: memberHistorySchema,
  serialize: JSON.stringify,
  perAccount: true,
});

export const useMemberHistory = (): MemberHistory => memberHistory.use();

interface NewChannel {
  addresses: readonly string[];
  files: LocalAttachmentInput[];
  appData?: string;
  name?: string;
}

export async function startNewChannel({ addresses, files, appData, name }: NewChannel): Promise<{ line: string; convId: string } | null> {
  schedulePushTopicRefresh(NEW_CHANNEL_PUSH_REFRESH_MS);
  uploadAttachments(files);
  const { line } = await createGroup([...addresses], appData, name);
  const convId = convIdOfLine(line);
  if (convId === null) return null;
  void memberHistory.update((current) => startedChatWith(current, addresses, Date.now())).catch(reported('newChatMembers.save'));
  return { line, convId };
}

export function useRequestPeers(peers: readonly { convId: string; peer: string }[]): ReadonlySet<string> {
  const [requests, setRequests] = useState(NO_REQUESTS);
  const key = peers.map((p) => p.convId).join(',');
  useEffect(() => {
    let cancelled = false;
    void Promise.all(peers.map(async (p) => ((await getConvConsentState(p.convId)) === 'unknown' ? [p.peer] : [])))
      .then((found) => {
        if (!cancelled) setRequests(new Set(found.flat()));
      })
      .catch(reported('newChat.requests'));
    return () => {
      cancelled = true;
    };
  }, [key]);
  return requests;
}
