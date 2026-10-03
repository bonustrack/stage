
import type { HistoryEntry } from '@stage-labs/client/types';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { isControlBody } from '../../lib/xmtp.types';
import { latestConvMessages, olderConvMessages, type ConvHandle } from '../../lib/xmtp.messages';
import { convOfLine, sdk } from '../../lib/xmtp.sdk';
import { PAGE_SIZE } from '../../lib/xmtp.resync';
import { deletedMessages, isDeleteRequest, type DeleteRights } from '@stage-labs/client/xmtp/deletions';
import { isCallSignalEntry } from '@stage-labs/client/xmtp/call';
import { ownDeletesReady } from '../../lib/ownDeletes';
import { convMembers } from '../../lib/xmtp.identity';
import { recover } from '../../lib/errorPolicy';
import { fetchSuperAdmins } from './convMeta.fetch';

const SEARCH_MAX_PAGES = 25;
const SEARCH_MAX_RESULTS = 50;

export interface SearchScanResult {
  hits: HistoryEntry[];
  truncated: boolean;
}

function matches(e: HistoryEntry, needle: string): boolean {
  if (!e.text) return false;
  if (isControlBody(e.text) || isCallSignalEntry(e)) return false;
  return e.text.toLowerCase().includes(needle);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

interface ScanState {
  hits: HistoryEntry[];
  seen: Set<string>;
  truncated: boolean;
  deleteRequests: HistoryEntry[];
  rights: DeleteRights;
}

async function readLocalSearchPage(
  conv: ConvHandle,
  beforeTsMs: number | undefined,
  line: string,
): Promise<HistoryEntry[] | null> {
  try {
    return beforeTsMs === undefined
      ? await latestConvMessages(conv, line, PAGE_SIZE)
      : await olderConvMessages(line, beforeTsMs, PAGE_SIZE);
  } catch {
    return null;
  }
}

function collectPageHits(mapped: HistoryEntry[], needle: string, state: ScanState): boolean {
  state.deleteRequests.push(...mapped.filter(isDeleteRequest));
  const deleted = deletedMessages([...state.deleteRequests, ...mapped], state.rights);
  for (const e of mapped) {
    if (state.seen.has(e.id)) continue;
    state.seen.add(e.id);
    if (!deleted.has(e.id) && !isDeleteRequest(e) && matches(e, needle)) {
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

const NO_SUPER_ADMINS: ReadonlySet<string> = new Set();

async function searchDeleteRights(conv: ConvHandle, line: string): Promise<DeleteRights> {
  const convId = convIdOfLine(line);
  const [ownDeletes, superAdmins] = await Promise.all([
    ownDeletesReady(),
    convId && sdk.isGroup(conv)
      ? fetchSuperAdmins(convId, (await convMembers(conv)).inboxToAddr).catch(recover('search.superAdmins', NO_SUPER_ADMINS))
      : NO_SUPER_ADMINS,
  ]);
  return { ownDeletes, superAdmins, selfInboxId: (await sdk.client()).inboxId };
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

  const state: ScanState = {
    hits: [], seen: new Set<string>(), truncated: false, deleteRequests: [], rights: await searchDeleteRights(conv, line),
  };
  let beforeTsMs: number | undefined;

  for (let page = 0; page < SEARCH_MAX_PAGES; page += 1) {
    if (shouldAbort()) break;
    const mapped = await readLocalSearchPage(conv, beforeTsMs, line);
    if (mapped === null || mapped.length === 0) break;

    const capped = collectPageHits(mapped, needle, state);
    const oldest = mapped[mapped.length - 1];
    if (oldest === undefined) break;
    beforeTsMs = new Date(oldest.ts).getTime();

    onResults({ hits: [...state.hits], truncated: state.truncated });

    if (shouldStopScan(capped, state, mapped.length, page)) break;
    await yieldToEventLoop();
  }

  const final: SearchScanResult = { hits: state.hits, truncated: state.truncated };
  onResults(final);
  return final;
}
