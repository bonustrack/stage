/** In-conversation full-text search over the LOCAL XMTP message history.
 *
 *  v1 scope: text content only (no attachments/reactions), current conversation
 *  only, no persistent index. We page through the conversation's local MLS db
 *  (`conv.messages` with a `beforeNs` cursor, same plumbing feedQuery uses for
 *  scroll-up) in chunks and filter on a case-insensitive substring match.
 *
 *  PERF (per the perf investigation): this is LOCAL ONLY - it never triggers an
 *  inbox-wide sync (`syncInboxOnce`). We scan a capped number of pages, yield to
 *  the event loop between pages so the UI stays responsive, and stream partial
 *  results to the caller via an `onResults` callback so matches appear
 *  progressively. The scan is abortable via the returned cancel handle. */

import type { HistoryEntry } from '../../lib/types';
import { isMetroControlBody } from '../../lib/push';
import { convOfLine } from '../../lib/xmtp.client';
import { envelopeOfXmtpMessage } from '../../lib/xmtp.messages';
import { PAGE_SIZE } from '../../lib/xmtp.stream';

/** A single search hit: the matched local message envelope. */
export type SearchHit = HistoryEntry;

/** Hard caps so a huge thread can't scan forever / blow memory. ~25 pages of
 *  PAGE_SIZE messages is plenty for v1; we surface the cap to the UI so it can
 *  note "showing first N / scan stopped early". */
export const SEARCH_MAX_PAGES = 25;
export const SEARCH_MAX_RESULTS = 50;

export interface SearchScanResult {
  /** Matches found, newest-first. Capped at SEARCH_MAX_RESULTS. */
  hits: SearchHit[];
  /** True if the scan hit a cap (pages or results) before exhausting history,
   *  so the UI can hint that older matches may exist. */
  truncated: boolean;
}

/** Lowercased substring match over a message's text body only. */
function matches(e: HistoryEntry, needle: string): boolean {
  if (!e.text) return false;
  if (isMetroControlBody(e.text)) return false;
  return e.text.toLowerCase().includes(needle);
}

/** Yield a macrotask so the JS thread can paint between pages. */
function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** Scan the local history of `line` for `query`, off the critical path.
 *
 *  Pages oldest-ward from the newest message using a `beforeNs` cursor (the same
 *  cursor math as feedQuery.loadFeedOlderPage), filters by substring, and
 *  invokes `onResults` with the growing hit list after each page so the UI can
 *  render progressively. Resolves with the final result when the scan ends
 *  (history exhausted, a cap reached, or aborted). Never throws. */
export async function searchLocalHistory(
  line: string,
  query: string,
  onResults: (partial: SearchScanResult) => void,
  shouldAbort: () => boolean,
): Promise<SearchScanResult> {
  const needle = query.trim().toLowerCase();
  const empty: SearchScanResult = { hits: [], truncated: false };
  if (!needle) return empty;

  const conv = await convOfLine(line);
  if (!conv) return empty;

  const hits: SearchHit[] = [];
  let truncated = false;
  let beforeNs: number | undefined;
  const seen = new Set<string>();

  for (let page = 0; page < SEARCH_MAX_PAGES; page += 1) {
    if (shouldAbort()) break;
    let batch: Awaited<ReturnType<typeof conv.messages>>;
    try {
      batch = await conv.messages({ limit: PAGE_SIZE, direction: 'DESCENDING', ...(beforeNs ? { beforeNs } : {}) });
    } catch {
      break; // local read failed; return what we have
    }
    if (batch.length === 0) break;

    const mapped = batch.map(m => envelopeOfXmtpMessage(m, line));
    for (const e of mapped) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (matches(e, needle)) {
        hits.push(e);
        if (hits.length >= SEARCH_MAX_RESULTS) { truncated = true; break; }
      }
    }
    /** Advance the cursor to just-before the oldest message of this page. */
    const oldest = mapped[mapped.length - 1];
    beforeNs = new Date(oldest.ts).getTime() * 1_000_000;

    onResults({ hits: [...hits], truncated });

    if (truncated) break;
    if (batch.length < PAGE_SIZE) break; // history exhausted
    if (page === SEARCH_MAX_PAGES - 1) truncated = true;

    await yieldToEventLoop();
  }

  const final: SearchScanResult = { hits, truncated };
  onResults(final);
  return final;
}
