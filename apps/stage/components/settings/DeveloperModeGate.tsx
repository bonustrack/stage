import type { ReactElement } from 'react';
import { Redirect, useIsFocused } from 'expo-router';
import { retryDeveloperMode, useDeveloperMode, useDeveloperModeLoaded, useDeveloperModeLoadFailed } from '../../lib/developerMode';
import { SETTINGS_ROUTE } from '../../lib/routes';
import { RetryNotice } from '../chrome/RetryNotice';

export function DeveloperModeGate({ children }: { children: ReactElement }): ReactElement | null {
  const enabled = useDeveloperMode();
  const loaded = useDeveloperModeLoaded();
  const failed = useDeveloperModeLoadFailed();
  const focused = useIsFocused();
  if (failed && focused) return <RetryNotice message="Developer mode could not be loaded." onRetry={retryDeveloperMode} />;
  if (!loaded) return null;
  if (enabled) return children;
  return focused ? <Redirect href={SETTINGS_ROUTE} /> : null;
}
