import { lazy, Suspense, useEffect, useRef } from 'react';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { errorMessage } from '@stage-labs/client/errors';
import { ResetBoundary } from '../bubble/boundary';
import { isOnboardingRoute, SIGNUP_ROUTE } from '../onboarding/nextRoute.model';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';
import {
  privyHostFailed,
  privyLogin,
  privyReturnHandled,
  returnedPrivyLogin,
  returnedPrivyMethod,
  usePrivyHostWanted,
  usePrivyReturning,
  wantPrivyHost,
} from '../../lib/privyBridge';
import { currentRoute } from '../../lib/routes';
import { getActiveAccount } from '../../lib/accounts';
import { sameAddress } from '../../lib/privyProvider.model';
import { signInCopy } from '../settings/SecuritySettings.model';
import { SignInCancelled } from '../../lib/signInCancelled';

const PrivyRuntime = lazy(async () => ({ default: (await import('./PrivyRuntime')).PrivyRuntime }));

async function resumeReturnedLogin(route: string): Promise<void> {
  if (returnedPrivyMethod() === null) return;
  wantPrivyHost();
  const pending = await returnedPrivyLogin();
  if (pending?.purpose === 'reauth') {
    privyReturnHandled();
    const [session, active] = await Promise.all([privyLogin(pending.method, 'reauth'), getActiveAccount()]);
    const copy = signInCopy(pending.method);
    capabilities.toast(sameAddress(session.address, active?.address) ? copy.done : copy.mismatch);
    return;
  }
  if (isOnboardingRoute(route)) return;
  if (pending === null) privyReturnHandled();
  else router.replace(SIGNUP_ROUTE);
}

function useReturnedLogin(): void {
  const pathname = usePathname();
  const navReady = useRootNavigationState()?.key !== undefined;
  const handled = useRef(false);
  useEffect(() => {
    if (!navReady || handled.current) return;
    handled.current = true;
    void resumeReturnedLogin(currentRoute(pathname)).catch((err: unknown) => {
      privyReturnHandled();
      if (!(err instanceof SignInCancelled)) capabilities.toast(errorMessage(err));
    });
  }, [navReady, pathname]);
}

export function useSignInReturnCover(pathname: string): boolean {
  return usePrivyReturning() && !isOnboardingRoute(pathname);
}

export function PrivyHost(): React.ReactElement | null {
  useReturnedLogin();
  if (!usePrivyHostWanted()) return null;
  return (
    <ResetBoundary
      resetKey={null}
      fallback={() => null}
      onError={(err) => {
        report('privy.host', err);
        privyHostFailed(new Error('Sign-in could not load. Check your connection and try again.'));
      }}
    >
      <Suspense fallback={null}>
        <PrivyRuntime />
      </Suspense>
    </ResetBoundary>
  );
}
