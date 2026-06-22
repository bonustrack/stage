
import { ConsentState, type Conversation } from '@xmtp/browser-sdk';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine, lineOfConv } from './xmtp';
import { peerEthAddressOfDm, groupMemberEthAddresses, shortAddress } from './xmtp';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import {
  summarizeRequest,
  type ConversationRequestView,
  type RequestSummaryFields,
} from '@stage-labs/client/xmtp/request';

interface RecentMsg { content: unknown; contentType?: { typeId?: string } }

async function summaryFieldsOf(conv: Conversation): Promise<RequestSummaryFields> {
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const meta = conv as unknown as { name?: string; imageUrl?: string };
  const msgs = await conv.messages({ limit: 1n }).catch(() => []);
  const last = [...msgs].reverse()[0] as RecentMsg | undefined;
  const preview = last ? previewOfXmtpContent(last.content, last.contentType?.typeId) : '';
  return {
    convId: conv.id,
    peerAddress,
    groupName: (meta.name ?? '').trim(),
    memberCount: memberAddresses.length,
    groupImage: (meta.imageUrl ?? '').trim() || null,
    preview,
    stampSeed: conv.id,
    shortPeer: peerAddress ? shortAddress(peerAddress) : '',
  };
}

export async function listRequestConvs(): Promise<ConversationRequestView[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  try { await client.conversations.syncAll([ConsentState.Unknown]); }
  catch { }
  const convs = await client.conversations
    .list({ consentStates: [ConsentState.Unknown] })
    .catch(() => [] as Conversation[]);
  const views: ConversationRequestView[] = [];
  for (const conv of convs) {
    views.push(summarizeRequest(await summaryFieldsOf(conv)));
  }
  return views;
}

export async function acceptRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await conv.updateConsentState(ConsentState.Allowed);
  try { await getCachedXmtpClient()?.preferences.sync(); }
  catch { }
}

export async function blockRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await conv.updateConsentState(ConsentState.Denied);
  try { await getCachedXmtpClient()?.preferences.sync(); }
  catch { }
}
