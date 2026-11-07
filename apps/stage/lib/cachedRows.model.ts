import { z } from 'zod';
import { groupTagsFrom } from '@stage-labs/client/xmtp/channelMeta';
import type { ChannelRow } from '@stage-labs/client/xmtp/channelsCache';
import type { XmtpConsent } from './xmtp.types';
import { storedRecordOf } from './storeCore';

export interface CachedRow extends ChannelRow {
  createdTs?: number | null;
  consent: XmtpConsent | null;
}

const isString = (value: unknown): value is string => typeof value === 'string';

const optionalString = z.string().optional().catch(undefined);
const nullableString = z.string().nullable().catch(null);
const nullableNumber = z.number().nullable().catch(null);

const rowFieldsSchema = z.object({
  convId: z.string(),
  title: z.string().catch(''),
  groupName: optionalString,
  peerAddress: z.string().nullable(),
  avatarUri: nullableString,
  avatarAddress: nullableString,
  inboxToAddr: storedRecordOf(isString).catch({}),
  selfInboxId: z.string().catch(''),
  lastTs: nullableNumber,
  lastBubbleTs: nullableNumber,
  lastPreview: z.string().catch(''),
  lastSenderAddress: nullableString,
  lastFromSelf: z.boolean().catch(false),
  unreadCount: z.number().catch(0),
  lastReadNs: z.number().catch(0),
  markedUnread: z.boolean().catch(false),
  createdTs: z.number().nullable().optional().catch(undefined),
  consent: z.enum(['allowed', 'denied', 'unknown']).nullable().catch(null),
});

const storedRowSchema = z.record(z.unknown());

function cachedRowOf(stored: unknown): CachedRow[] {
  const fields = storedRowSchema.safeParse(stored);
  if (!fields.success) return [];
  const row = rowFieldsSchema.safeParse(fields.data);
  return row.success ? [{ ...groupTagsFrom(fields.data), ...row.data }] : [];
}

export function cachedRowsOf(stored: unknown): CachedRow[] | null {
  return Array.isArray(stored) ? stored.flatMap(cachedRowOf) : null;
}
