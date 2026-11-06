import type { HistoryEntry } from '@stage-labs/client/types';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { latestConvMessages, olderConvMessages, type ConvHandle } from '../xmtp.messages';
import { convOfLine, sdk } from '../xmtp.sdk';
import { PAGE_SIZE } from '../feed/resync';
import { deletedMessages, type DeleteRights } from '@stage-labs/client/xmtp/deletions';
import { isDeleteRequest } from '@stage-labs/client/xmtp/entryPayload';
import { isSearchable } from '@stage-labs/client/xmtp/visibility';
import { convMembers } from '../xmtp.identity';
import { deleteRightsOf } from './deleteRights';
import { sleep } from '@stage-labs/client/timing';

const SEARCH_MAX_PAGES = 25;
const SEARCH_MAX_RESULTS = 50;

export interface SearchScanResult {
  hits: HistoryEntry[];
  truncated: boolean;
}

function matches(e: HistoryEntry, needle: string): boolean {
  return isSearchable(e) && (e.text ?? '').toLowerCase().includes(needle);
}

interface ScanState {
  hits: HistoryEntry[];
  seen: Set<string>;
  truncated: boolean;
  deleteRequests: HistoryEntry[];
  rights: DeleteRights;
}

async function readLocalSearchPage(conv: ConvHandle, beforeTsMs: number | undefined, line: string): Promise<HistoryEntry[] | null> {
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
    if (!deleted.has(e.id) && matches(e, needle)) {
      state.hits.push(e);
      if (state.hits.length >= SEARCH_MAX_RESULTS) {
        state.truncated = true;
        return true;
      }
    }
  }
  return false;
}

function shouldStopScan(capped: boolean, state: ScanState, pageLen: number, page: number): boolean {
  if (capped || state.truncated) return true;
  if (pageLen < PAGE_SIZE) return true;
  if (page === SEARCH_MAX_PAGES - 1) {
    state.truncated = true;
    return true;
  }
  return false;
}

async function searchDeleteRights(conv: ConvHandle, line: string): Promise<DeleteRights> {
  const convId = convIdOfLine(line);
  const admins =
    convId && sdk.isGroup(conv) ? { convId, inboxToAddr: (await convMembers(conv)).inboxToAddr, where: 'search.superAdmins' } : null;
  const rights = await deleteRightsOf(admins, null);
  return { ...rights, selfInboxId: (await sdk.client()).inboxId };
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
    hits: [],
    seen: new Set<string>(),
    truncated: false,
    deleteRequests: [],
    rights: await searchDeleteRights(conv, line),
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
    await sleep(0);
  }

  const final: SearchScanResult = { hits: state.hits, truncated: state.truncated };
  onResults(final);
  return final;
}
