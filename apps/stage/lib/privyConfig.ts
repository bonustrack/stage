import { Platform } from 'react-native';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { envString } from './env';
import { WALLET_ENABLED } from './features';
import { loginMethodsFor, socialsFrom } from './privyMethods.model';

export const PRIVY_APP_ID = envString(process.env.EXPO_PUBLIC_PRIVY_APP_ID);
export const PRIVY_CLIENT_ID = envString(process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID);
export const WALLETCONNECT_PROJECT_ID = envString(process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID);

const SOCIALS = socialsFrom(envString(process.env.EXPO_PUBLIC_PRIVY_LOGINS));
const MICROSOFT_PROVIDER = (envString(process.env.EXPO_PUBLIC_PRIVY_MICROSOFT_PROVIDER) ?? 'microsoft').replace(/^custom:/, '');

export type PrivyOAuthProvider = 'google' | 'github' | `custom:${string}`;

export function privyOAuthProvider(method: PrivyLoginMethod): PrivyOAuthProvider {
  if (method === 'google' || method === 'github') return method;
  return `custom:${MICROSOFT_PROVIDER}`;
}

export function privyLinkedType(method: PrivyLoginMethod): string {
  if (method === 'google' || method === 'github') return `${method}_oauth`;
  return privyOAuthProvider(method);
}

function credentiallessFrames(): boolean {
  const frame = (globalThis as { HTMLIFrameElement?: { prototype: object } }).HTMLIFrameElement;
  return frame !== undefined && 'credentialless' in frame.prototype;
}

export function privyLoginMethods(): PrivyLoginMethod[] {
  return loginMethodsFor({
    privyApp: PRIVY_APP_ID !== undefined,
    walletFeature: WALLET_ENABLED,
    socials: SOCIALS,
    web: Platform.OS === 'web',
    extension: (globalThis as { location?: { protocol?: string } }).location?.protocol === 'chrome-extension:',
    desktop: (globalThis as { stageDesktop?: unknown }).stageDesktop !== undefined,
    isolatedPage: (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true,
    credentiallessFrames: credentiallessFrames(),
    walletConnect: WALLETCONNECT_PROJECT_ID !== undefined,
  });
}
