import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';

const SOCIAL_METHODS: readonly PrivyLoginMethod[] = ['google', 'microsoft', 'github', 'email'];
const DEFAULT_SOCIALS: readonly PrivyLoginMethod[] = ['google'];

export function socialsFrom(raw: string | undefined): PrivyLoginMethod[] {
  if (raw === undefined) return [...DEFAULT_SOCIALS];
  const wanted = new Set(raw.split(',').map((part) => part.trim().toLowerCase()));
  return SOCIAL_METHODS.filter((method) => wanted.has(method));
}

export interface PrivySupport {
  privyApp: boolean;
  socials: readonly PrivyLoginMethod[];
  walletFeature: boolean;
  web: boolean;
  extension: boolean;
  desktop: boolean;
  isolatedPage: boolean;
  credentiallessFrames: boolean;
  walletConnect: boolean;
}

function socialMethods(support: PrivySupport): PrivyLoginMethod[] {
  if (!support.privyApp || support.extension || support.desktop) return [];
  if (support.web && support.isolatedPage && !support.credentiallessFrames) return [];
  return [...support.socials];
}

function walletAvailable(support: PrivySupport): boolean {
  if (!support.walletFeature) return false;
  return support.walletConnect || (support.web && !support.desktop && !support.extension);
}

export function loginMethodsFor(support: PrivySupport): PrivyLoginMethod[] {
  return [...socialMethods(support), ...(walletAvailable(support) ? (['wallet'] as const) : [])];
}
