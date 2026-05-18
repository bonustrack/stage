/** Vue composable that mirrors the RN useTail hook: seeds from /api/state, then streams /api/tail. */
/** Reconnects on chat-filter change; caller controls lifecycle via the returned `stop`. */

import { ref, watch, type Ref } from 'vue';
import { fetchHistoryPage, fetchState, openTail } from './api';
import { isConfigured, type Config } from './config';
import type { HistoryEntry } from './types';

type Status = 'idle' | 'connecting' | 'open' | 'error' | 'closed';

export interface UseTailHandle {
  events: Ref<HistoryEntry[]>;
  older: Ref<HistoryEntry[]>;
  olderDone: Ref<boolean>;
  loadingOlder: Ref<boolean>;
  status: Ref<Status>;
  errMsg: Ref<string | null>;
  reconnect: () => void;
  loadOlder: () => Promise<void>;
  stop: () => void;
}

export function useTail(cfg: Ref<Config>, chat: Ref<string | undefined>): UseTailHandle {
  const events = ref<HistoryEntry[]>([]);
  const older = ref<HistoryEntry[]>([]);
  const olderDone = ref(false);
  const loadingOlder = ref(false);
  const status = ref<Status>('idle');
  const errMsg = ref<string | null>(null);
  let abort: AbortController | null = null;

  const reconnect = (): void => {
    abort?.abort();
    events.value = []; older.value = []; olderDone.value = false; errMsg.value = null;
    if (!isConfigured(cfg.value)) { status.value = 'idle'; return; }
    status.value = 'connecting';
    void fetchState(cfg.value.daemonUrl, cfg.value.token).then(r => {
      if (!r.ok) return;
      const seed = (r.data as { recent_history?: HistoryEntry[] }).recent_history ?? [];
      events.value = (chat.value ? seed.filter(e => e.line === chat.value) : seed).slice(0, 500);
    });
    abort = new AbortController();
    void openTail({
      daemonUrl: cfg.value.daemonUrl, token: cfg.value.token,
      as: cfg.value.userId || undefined, chat: chat.value, includeWebhooks: true,
      signal: abort.signal,
      onOpen: () => { status.value = 'open'; },
      onEntry: e => { events.value = [e, ...events.value.filter(x => x.id !== e.id)].slice(0, 500); },
      onError: m => { status.value = 'error'; errMsg.value = m; },
      onClose: () => { status.value = 'closed'; },
    });
  };

  const loadOlder = async (): Promise<void> => {
    if (olderDone.value || loadingOlder.value) return;
    loadingOlder.value = true;
    const before = events.value.length + older.value.length;
    const r = await fetchHistoryPage(cfg.value.daemonUrl, cfg.value.token, before, 20);
    loadingOlder.value = false;
    if (!r.ok || r.entries.length === 0) { olderDone.value = true; return; }
    const seen = new Set([...events.value, ...older.value].map(e => e.id));
    older.value = [...older.value, ...r.entries.filter(e => !seen.has(e.id))];
  };

  watch(chat, reconnect);
  return {
    events, older, olderDone, loadingOlder, status, errMsg,
    reconnect, loadOlder, stop: () => abort?.abort(),
  };
}
