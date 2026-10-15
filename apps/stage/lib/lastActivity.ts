import {
  DEFAULT_LAST_ACTIVITY, lastActivityCutoff, parseLastActivity, type ActivityView, type LastActivity,
} from '../components/home/activity.model';
import { getAccountEpoch, subscribeAccountEpoch } from './accountEpoch';
import { isAppInFront, subscribeAppInFront } from './appInFront';
import { reported } from './errorPolicy';
import { createValueStore } from './persistedStore';
import { makeSharedSource, useStoreValue } from './storeCore';

const prefs = createValueStore({
  key: 'home.activity.', default: DEFAULT_LAST_ACTIVITY, deserialize: parseLastActivity, serialize: JSON.stringify, perAccount: true,
});

function subscribePreferences(onChange: () => void): () => void {
  const offPrefs = prefs.subscribe(onChange);
  const offAccount = subscribeAccountEpoch(onChange);
  return () => { offPrefs(); offAccount(); };
}

export function getLastActivity(view: ActivityView): LastActivity {
  return prefs.isCurrentAccount() ? prefs.get()[view] : 'all';
}

export function useLastActivity(view: ActivityView): LastActivity {
  return useStoreValue(subscribePreferences, () => getLastActivity(view), prefs.loadAsync);
}

export function setLastActivity(view: ActivityView, window: LastActivity): void {
  const epoch = getAccountEpoch();
  void prefs.update(current => epoch === getAccountEpoch() ? { ...current, [view]: window } : current)
    .catch(reported('lastActivity.save'));
}

let now = Date.now();
const clock = makeSharedSource<undefined>((_source, emit) => {
  const refresh = (): void => { now = Date.now(); emit(); };
  refresh();
  const timer = setInterval(refresh, 60_000);
  const off = subscribeAppInFront(() => { if (isAppInFront()) refresh(); });
  return () => { clearInterval(timer); off(); };
});
const subscribeClock = (onChange: () => void): (() => void) => clock(undefined, onChange);
const noClock = (): (() => void) => () => undefined;
const clockNow = (): number => now;

export function useLastActivityCutoff(view: ActivityView): number | null {
  const window = useLastActivity(view);
  const current = useStoreValue(window === 'all' ? noClock : subscribeClock, clockNow);
  return lastActivityCutoff(window, current);
}
