
import type { HistoryEntry } from '@stage-labs/client/types';
import { isMetroControlBody } from '../../lib/push';
import { convOfLine } from '../../lib/xmtp.client';
import { envelopeOfXmtpMessage } from '../../lib/xmtp.messages';
import { PAGE_SIZE } from '../../lib/xmtp.stream';

export type SearchHit = HistoryEntry;

export const SEARCH_MAX_PAGES = 25;
export const SEARCH_MAX_RESULTS = 50;

export interface SearchScanResult {
  hits: SearchHit[];
  truncated: boolean;
}

function matches(e: HistoryEntry, needle: string): boolean {
  if (!e.text) return false;
  if (isMetroControlBody(e.text)) return false;
  return e.text.toLowerCase().includes(needle);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

interface ScanState {
  hits: SearchHit[];
  seen: Set<string>;
  truncated: boolean;
}

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

function shouldStopScan(
  capped: boolean, state: ScanState, pageLen: number, page: number,
): boolean {
  if (capped || state.truncated) return true;
  if (pageLen < PAGE_SIZE) return true;
  if (page === SEARCH_MAX_PAGES - 1) { state.truncated = true; return true; }
  return false;
}

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
    if (mapped === null || mapped.length === 0) break;

    const capped = collectPageHits(mapped, needle, state);
    const oldest = mapped[mapped.length - 1];
    if (oldest === undefined) break;
    beforeNs = new Date(oldest.ts).getTime() * 1_000_000;

    onResults({ hits: [...state.hits], truncated: state.truncated });

    if (shouldStopScan(capped, state, mapped.length, page)) break;
    await yieldToEventLoop();
  }

  const final: SearchScanResult = { hits: state.hits, truncated: state.truncated };
  onResults(final);
  return final;
}
