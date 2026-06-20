/** @file In-conversation full-text search over the LOCAL XMTP message history only: pages the local MLS db in capped chunks, filters on a case-insensitive substring, and streams abortable partial results via an onResults callback. */

import type { HistoryEntry } from '../../lib/types';
import { isMetroControlBody } from '../../lib/push';
import { convOfLine } from '../../lib/xmtp.client';
import { envelopeOfXmtpMessage } from '../../lib/xmtp.messages';
import { PAGE_SIZE } from '../../lib/xmtp.stream';

/** A single search hit: the matched local message envelope. */
export type SearchHit = HistoryEntry;

/** Hard caps so a huge thread can't scan forever / blow memory. ~25 pages of PAGE_SIZE messages is plenty for v1; we surface the cap to the UI so it can note "showing first N / scan stopped early". */
export const SEARCH_MAX_PAGES = 25;
export const SEARCH_MAX_RESULTS = 50;

export interface SearchScanResult {
  /** Matches found, newest-first. Capped at SEARCH_MAX_RESULTS. */
  hits: SearchHit[];
  /** True if the scan hit a cap (pages or results) before exhausting history, so the UI can hint that older matches may exist. */
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

interface ScanState {
  hits: SearchHit[];
  seen: Set<string>;
  truncated: boolean;
}

/** Read one DESCENDING page of local messages before the cursor, mapped to envelopes; null on read failure. */
async function readLocalSearchPage(
  conv: NonNullable<Awaited<ReturnType<typeof convOfLine>>>,
  beforeNs: number | undefined,
  line: string,
): Promise<HistoryEntry[] | null> {
  try {
    const batch = await conv.messages({
      limit: PAGE_SIZE, direction: 'DESCENDING', ...(beforeNs ? { beforeNs } : {}),
    });
    return batch.map(m => envelopeOfXmtpMessage(m, line));
  } catch {
    return null;
  }
}

/** Fold a page's matches into the scan state; returns true when the result cap is hit. */
function collectPageHits(mapped: HistoryEntry[], needle: string, state: ScanState): boolean {
  for (const e of mapped) {
    if (state.seen.has(e.id)) continue;
    state.seen.add(e.id);
    if (matches(e, needle)) {
      state.hits.push(e);
      if (state.hits.length >= SEARCH_MAX_RESULTS) { state.truncated = true; return true; }
    }
  }
  return false;
}

/** Decide whether to stop scanning after a page; marks truncated when the final page is reached. */
function shouldStopScan(
  capped: boolean, state: ScanState, pageLen: number, page: number,
): boolean {
  if (capped || state.truncated) return true;
  if (pageLen < PAGE_SIZE) return true; /** history exhausted */
  if (page === SEARCH_MAX_PAGES - 1) { state.truncated = true; return true; }
  return false;
}

/** Scan the local history of `line` for `query` off the critical path, paging oldest-ward via a `beforeNs` cursor and invoking `onResults` after each page for progressive render; resolves on exhaustion/cap/abort and never throws. */
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

  const state: ScanState = { hits: [], seen: new Set<string>(), truncated: false };
  let beforeNs: number | undefined;

  for (let page = 0; page < SEARCH_MAX_PAGES; page += 1) {
    if (shouldAbort()) break;
    const mapped = await readLocalSearchPage(conv, beforeNs, line);
    if (mapped === null || mapped.length === 0) break; /** read failed / exhausted */

    const capped = collectPageHits(mapped, needle, state);
    /** Advance the cursor to just-before the oldest message of this page. */
    const oldest = mapped[mapped.length - 1];
    if (oldest === undefined) break; /** empty page (batch was non-empty above) */
    beforeNs = new Date(oldest.ts).getTime() * 1_000_000;

    onResults({ hits: [...state.hits], truncated: state.truncated });

    if (shouldStopScan(capped, state, mapped.length, page)) break;
    await yieldToEventLoop();
  }

  const final: SearchScanResult = { hits: state.hits, truncated: state.truncated };
  onResults(final);
  return final;
}
