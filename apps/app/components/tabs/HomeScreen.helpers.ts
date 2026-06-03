/** HomeScreen helpers — the Row shape + the pure summarise/format/topic utils
 *  extracted from HomeScreen.tsx (phase-2 lint, behaviour identical). */

import type { Conversation, DecodedMessage } from '@xmtp/react-native-sdk';
import {
  peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap,
  shortAddress, getLastReadNs,
} from '../../lib/xmtp';
import { isMetroControlBody } from '../../lib/push';
import { previewOfXmtpContent } from '@metro-labs/client/xmtp/humanize';
import { channelStampSeed } from '@metro-labs/kit/avatar';
import { labelsOfSyncedGroup } from '../../lib/xmtp.labels';
import { githubOfSyncedGroup } from '../../lib/xmtp.github';

export interface Row {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  /** Eth address whose stamp.fyi avatar should render in the row. Resolved
   *  to the latest sender when there's a message, else the peer (DMs) or
   *  the first other member (groups). Ignored when `avatarUri` is set. */
  avatarAddress: string | null;
  /** Group-uploaded image (ipfs:// or http URL). Takes precedence over
   *  `avatarAddress` — when set, the row renders this image directly so
   *  groups show their own avatar instead of a member's stamp. */
  avatarUri: string | null;
  /** DM peer address (null for groups) — drives showing the peer's display name. */
  peerAddress: string | null;
  /** Eth address of the latest message's sender (null if self/unknown). */
  lastSenderAddress: string | null;
  /** Whether the local user sent the latest message → "You: …" preview prefix. */
  lastFromSelf: boolean;
  /** Cached inbox → eth address map, kept so live stream updates can resolve
   *  a new sender's avatar without an extra round-trip. */
  inboxToAddr: Record<string, string>;
  /** Count of messages newer than the per-conv lastReadNs that the LOCAL
   *  user didn't send. 0 hides the badge. */
  unreadCount: number;
  /** Cached lastReadNs — kept so streamAllMessages updates can recompute the
   *  count without a SecureStore round-trip per new msg. */
  lastReadNs: number;
  /** Synced (cross-device) "explicitly marked unread" flag from XMTP consent
   *  state. Forces the badge on even when the timestamp count is 0. */
  markedUnread: boolean;
  /** Own inbox id — also needed to filter own messages out of the unread
   *  recount on stream updates. */
  selfInboxId: string;
  /** Group labels (from the group's synced XMTP appData), GROUPS ONLY — empty
   *  for DMs. Read in summarize() off the already-synced conv (no extra sync),
   *  so they refresh on every list refresh/poll. Rendered as chips on the card. */
  labels: string[];
  /** Optional linked GitHub issue/PR URL from the group's synced appData,
   *  GROUPS ONLY (undefined for DMs / unset). Read off the already-synced conv.
   *  Drives the GitHub icon in the conversation topnav. */
  github?: string;
  /** Make Row a structural superset of `CachedRow` so we can pass it
   *  straight through `setCachedRows` without casting. */
  [key: string]: unknown;
}

/** Extract the conversation id from an XMTP MLS topic. Stream `DecodedMessage`s
 *  only expose `topic` (`/xmtp/mls/1/g-<hexId>/proto`), not `conversationId`, so
 *  the `g-<id>` segment is the bridge back to `Row.convId` (which stores
 *  `conv.id`). Returns null when the topic doesn't match the expected shape. */
export function convIdFromTopic(topic: string | undefined): string | null {
  if (!topic) return null;
  const m = /\/g-([0-9a-fA-F]+)\//.exec(topic);
  return m ? m[1]! : null;
}

/** Fixed ChannelRow height: 14px vertical padding ×2 + ~48px content (title 22 +
 *  4 margin + 22 badge-reserve) + 1px separator. Used by getItemLayout (#5).
 *  Group label chips render INLINE on the name row (not a separate line), so
 *  every row is uniform height regardless of labels. */
export const CHANNEL_ROW_HEIGHT = 77;

export function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export async function summarize(conv: Conversation, selfInboxId: string): Promise<Row> {
  await conv.sync().catch(() => undefined);
  /** #2: pull only the latest message for the row PREVIEW — we no longer recompute
   *  the unread count from 50 msgs per row (that's now maintained incrementally
   *  from the live stream deltas). A previously-read conv seeds unreadCount=0; the
   *  global stream bumps it on each new inbound. "Marked unread" still surfaces
   *  via the lastReadNs marker below. We fetch 2 so a trailing control DM doesn't blank
   *  the preview. */
  const recent: DecodedMessage[] = await conv.messages({ limit: 2 }).catch(() => []);
  const msgs = recent;
  /** Skip our own register-push control DMs (plain-text, magic-prefixed) when
   *  choosing the row's "last message" so the preview never shows METRO_CTRL:. */
  const last = msgs.find(m => {
    try { const c = m.content(); return !(typeof c === 'string' && isMetroControlBody(c)); }
    catch { return true; }
  }) ?? msgs[0];
  let preview = '';
  if (last) {
    try { preview = previewOfXmtpContent(last.content(), last.contentTypeId); }
    catch { preview = `[${last.contentTypeId ?? 'unknown'}]`; }
  }
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const totalMembers = memberAddresses.length + 1;
  /** Read group metadata (name + uploaded image) in one shot for groups. */
  const groupMeta = peerAddress
    ? { name: '', imageUrl: '' }
    : await (async (): Promise<{ name: string; imageUrl: string }> => {
        const g = conv as unknown as { name?: () => Promise<string>; imageUrl?: () => Promise<string> };
        const [n, img] = await Promise.all([
          g.name?.() ?? Promise.resolve(''),
          g.imageUrl?.().catch(() => '') ?? Promise.resolve(''),
        ]);
        return { name: n ?? '', imageUrl: img ?? '' };
      })();
  /** Group labels (DMs have none). Read off the conv synced above at line ~77,
   *  so no extra group.sync() fires per row — refreshes on each list refresh. */
  const labels = peerAddress ? [] : await labelsOfSyncedGroup(conv);
  const github = peerAddress ? undefined : await githubOfSyncedGroup(conv);
  const title = peerAddress
    ? shortAddress(peerAddress)
    : (groupMeta.name.trim()
      ? groupMeta.name.trim()
      : memberAddresses.length > 0
        ? `${totalMembers} member${totalMembers === 1 ? '' : 's'}`
        : conv.topic.replace(/^.*\//, '').slice(0, 12));
  /** For DMs: use the peer's stamp. For groups with an uploaded image:
   *  use that image (via avatarUri). Otherwise fall back to the latest
   *  sender / first member stamp. */
  const lastSenderAddress = last?.senderInboxId
    ? inboxToAddr[last.senderInboxId] ?? null
    : null;
  const lastFromSelf = !!last && last.senderInboxId === selfInboxId;
  const avatarUri = peerAddress ? null : (groupMeta.imageUrl.trim() || null);
  /** Avatar seed precedence:
   *   - DM: the peer's stamp (real eth address).
   *   - Group WITH an uploaded image: handled by `avatarUri` (address ignored).
   *   - Group WITHOUT an image: a deterministic stamp seeded by the channel id
   *     so every channel gets its OWN stable identicon (not a member's). */
  const avatarAddress = peerAddress
    ?? (avatarUri ? null : channelStampSeed(conv.id));
  /** Unread count = msgs newer than the persisted lastReadNs not sent by us. */
  const lastReadNs = await getLastReadNs(conv.id);
  let unreadCount = 0;
  for (const m of msgs) {
    if (!m.sentNs || m.sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
  /** Explicit "mark unread" flag, derived purely from the per-device
   *  `lastReadNs`: a rewound marker (`lastReadNs === 0`) with an inbound last
   *  message and no timestamp-counted unreads means the user (or a never-read
   *  fresh conv) wants a badge. No XMTP consent involved. */
  const markedUnread = lastReadNs === 0
    && unreadCount === 0 && !!last && !lastFromSelf;
  return {
    convId: conv.id,
    title,
    lastTs: last?.sentNs ? Math.floor(last.sentNs / 1_000_000) : null,
    lastPreview: preview.slice(0, 80),
    avatarAddress,
    avatarUri,
    peerAddress,
    lastSenderAddress,
    lastFromSelf,
    inboxToAddr,
    unreadCount,
    lastReadNs,
    selfInboxId,
    markedUnread,
    labels,
    github,
  };
}
