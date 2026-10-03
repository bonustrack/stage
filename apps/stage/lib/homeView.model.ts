import { DEFAULT_HOME_VIEW, type HomeViewContent, type HomeViewEdit } from '@stage-labs/client/xmtp/readState';

export function syncsHomeView(edit: HomeViewEdit): boolean {
  return edit.groupBy !== undefined || edit.columnBy !== undefined;
}

export function editHomeView(current: HomeViewContent, edit: HomeViewEdit, now: number): HomeViewContent {
  const next = { ...current, ...edit };
  return syncsHomeView(edit) ? { ...next, at: Math.max(now, current.at + 1) } : next;
}

export function receiveHomeView(current: HomeViewContent, incoming: HomeViewContent): HomeViewContent {
  return incoming.at > current.at ? { ...incoming, view: current.view } : current;
}

export function syncedHomeView(state: HomeViewContent): HomeViewContent {
  return { ...state, view: DEFAULT_HOME_VIEW.view };
}
