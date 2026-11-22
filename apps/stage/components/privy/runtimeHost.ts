import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import type { PrivyOAuthProvider } from '../../lib/privyConfig';
import type { PrivyController, PrivyLoginPurpose } from '../../lib/privy.types';

export const PRIVY_RUNTIME_URL = '/privy/runtime.js';

export interface PrivyRuntimeHost {
  appId: string;
  clientId?: string;
  dark: boolean;
  accent?: `#${string}`;
  desktop: boolean;
  oauthRedirectUrl?: string;
  returned: boolean;
  oauthProvider: (method: PrivyLoginMethod) => PrivyOAuthProvider;
  linkedType: (method: PrivyLoginMethod) => string;
  pending: { write: (method: PrivyLoginMethod, purpose: PrivyLoginPurpose) => Promise<void>; clear: () => Promise<void> };
  register: (controller: PrivyController) => () => void;
  failed: (reason: Error) => void;
}

export interface PrivyStandalone {
  mount: (host: PrivyRuntimeHost) => void;
}

interface RuntimeScope {
  __stagePrivy?: PrivyStandalone;
}

export function publishedPrivyRuntime(): PrivyStandalone | undefined {
  return (globalThis as RuntimeScope).__stagePrivy;
}

export function publishPrivyRuntime(runtime: PrivyStandalone): void {
  (globalThis as RuntimeScope).__stagePrivy = runtime;
}
