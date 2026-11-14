import type { HistoryEntry } from '@stage-labs/client/types';
import { shortTypeId } from '@stage-labs/client/xmtp/deleteMessage';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';

const WALLET_TYPE_IDS: ReadonlySet<string> = new Set(['walletSendCalls', 'transactionReference', 'signatureRequest', 'signatureReference']);

export const UNSUPPORTED_MESSAGE_TEXT = 'Unsupported message';

function isWalletTypeId(contentTypeId: string | null | undefined): boolean {
  return WALLET_TYPE_IDS.has(shortTypeId(contentTypeId));
}

export function walletFreeEntry(entry: HistoryEntry, wallet: boolean): HistoryEntry {
  const typeId = (entry.payload as { contentType?: unknown } | undefined)?.contentType;
  if (wallet || typeof typeId !== 'string' || !isWalletTypeId(typeId)) return entry;
  return { ...entry, text: UNSUPPORTED_MESSAGE_TEXT, payload: { contentType: typeId } };
}

export function chatPreviewOf(decoded: unknown, contentTypeId: string | null | undefined, wallet: boolean): string {
  if (!wallet && isWalletTypeId(contentTypeId)) return UNSUPPORTED_MESSAGE_TEXT;
  return previewOfXmtpContent(decoded, contentTypeId);
}
