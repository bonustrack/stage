/** Daemon-side group-name cache → `line_name` on inbound envelopes, without
 *  hammering XMTP per message (mirrors wire.ts inbox→eth). `Group.name` is a
 *  local sync getter, so reads are zero-network even on a miss. */

const NAME_CACHE_MAX = 5000;
/** convId → name ('' = known-empty, still cached to avoid retry). */
const convNameCache = new Map<string, string>();

function remember(convId: string, name: string): void {
  // Re-insert to refresh LRU order; evict oldest past the cap.
  convNameCache.delete(convId);
  convNameCache.set(convId, name);
  if (convNameCache.size > NAME_CACHE_MAX) {
    const oldest = convNameCache.keys().next().value;
    if (oldest !== undefined) convNameCache.delete(oldest);
  }
}

/** Read a group's name off the (local) Conversation. DMs expose peerInboxId()
 *  and have no name → ''. `name` is usually a sync getter but some bindings
 *  expose it as an async fn — handle both. Never throws. */
async function readName(conv: unknown): Promise<string> {
  try {
    if (typeof (conv as { peerInboxId?: unknown }).peerInboxId === 'function') return ''; // DM
    const n = (conv as { name?: string | (() => Promise<string>) }).name;
    const resolved = typeof n === 'function' ? await n() : n;
    return typeof resolved === 'string' ? resolved : '';
  } catch { return ''; }
}

/** Cached group-name lookup for an inbound Conversation. Hit → instant; miss →
 *  one local read (no network), then cached. */
export async function groupNameFor(convId: string, conv: unknown): Promise<string> {
  const cached = convNameCache.get(convId);
  if (cached !== undefined) return cached;
  const name = await readName(conv);
  remember(convId, name);
  return name;
}

/** Warm/refresh the cache from a known name (e.g. just created the group), to
 *  avoid a cold first-message miss. */
export function warmGroupName(convId: string, name: string | undefined): void {
  if (typeof name === 'string' && name) remember(convId, name);
}
