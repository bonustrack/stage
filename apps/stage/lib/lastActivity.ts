import {
  DEFAULT_LAST_ACTIVITY,
  lastActivityCutoff,
  lastActivitySchema,
  type ActivityPreferences,
  type LastActivity,
} from './lastActivity.model';
import type { HomeView } from './homeView';
import { accountScope } from './accountSelection';
import { isAppInFront, subscribeAppInFront } from './appInFront';
import { reported } from './errorPolicy';
import { createValueStore } from './persistedStore';
import { makeSharedSource, useStoreValue } from './storeCore';

const prefs = createValueStore<ActivityPreferences>({
  key: 'home.activity.',
  default: DEFAULT_LAST_ACTIVITY,
  schema: lastActivitySchema,
  perAccount: true,
});

export function getLastActivity(view: HomeView): LastActivity {
  return prefs.loaded() ? prefs.get()[view] : 'all';
}

export function useLastActivity(view: HomeView): LastActivity {
  return useStoreValue(prefs.subscribe, () => getLastActivity(view), prefs.loadAsync);
}

export const useLastActivitySettled = prefs.useSettled;

export function setLastActivity(view: HomeView, window: LastActivity): void {
  const scope = accountScope();
  void prefs.update((current) => (scope.current() ? { ...current, [view]: window } : current)).catch(reported('lastActivity.save'));
}

let now = Date.now();
const clock = makeSharedSource<undefined>((_source, emit) => {
  const refresh = (): void => {
    now = Date.now();
    emit();
  };
  refresh();
  const timer = setInterval(refresh, 60_000);
  const off = subscribeAppInFront(() => {
    if (isAppInFront()) refresh();
  });
  return () => {
    clearInterval(timer);
    off();
  };
});
const subscribeClock = (onChange: () => void): (() => void) => clock(undefined, onChange);
const noClock = (): (() => void) => () => undefined;
const clockNow = (): number => now;

export function useLastActivityCutoff(view: HomeView): number | null {
  const window = useLastActivity(view);
  const current = useStoreValue(window === 'all' ? noClock : subscribeClock, clockNow);
  return lastActivityCutoff(window, current);
}
