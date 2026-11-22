import { concatHex, isAddress, isHex, keccak256, stringToHex, type Hex } from 'viem';
import { z } from 'zod';
import { parseOrThrow } from '../validate';
import type { AccountRecord, PrivyLoginMethod } from './types';

export const PRIVY_LOGIN_METHODS: readonly PrivyLoginMethod[] = ['google', 'microsoft', 'github', 'email', 'wallet'];

export type PrivySignerKind = 'embedded' | 'external';

const METHOD_NAMES: Record<PrivyLoginMethod, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  github: 'GitHub',
  email: 'email',
  wallet: 'Wallet',
};

const SIGNATURE_BYTES = 65;

export function isPrivyLoginMethod(value: unknown): value is PrivyLoginMethod {
  return typeof value === 'string' && (PRIVY_LOGIN_METHODS as readonly string[]).includes(value);
}

export function privyMethodName(method: PrivyLoginMethod): string {
  return METHOD_NAMES[method];
}

export function privySignerKind(method: PrivyLoginMethod): PrivySignerKind {
  return method === 'wallet' ? 'external' : 'embedded';
}

export function privyLoginOf(rec: AccountRecord): PrivyLoginMethod {
  return rec.login ?? 'wallet';
}

export function privyAccountRecord(address: string, method: PrivyLoginMethod, now: number = Date.now()): AccountRecord {
  if (!isAddress(address)) throw new Error('The sign-in did not return a wallet address.');
  const id = address.toLowerCase();
  return { id, address, type: 'privy', dbDir: `xmtp-${id}`, registered: false, createdAt: now, login: method };
}

export function privyUnlockMessage(address: string): string {
  return [
    'Stage: unlock this account on this device.',
    '',
    'Only sign this message in the Stage app or on stage.box. It creates the keys that protect your notifications and mail, so never sign it anywhere else.',
    '',
    `Account: ${address.toLowerCase()}`,
  ].join('\n');
}

export function isUnlockSignature(value: unknown): value is Hex {
  return isHex(value) && value.length >= 2 + SIGNATURE_BYTES * 2;
}

export function derivedSignature(unlock: Hex, message: string): Hex {
  const seed = keccak256(concatHex([unlock, stringToHex(message)]));
  const r = keccak256(concatHex([seed, '0x01']));
  const s = keccak256(concatHex([seed, '0x02']));
  return concatHex([r, s, '0x1b']);
}

const customProviderSchema = z.object({
  provider: z.string(),
  provider_display_name: z.string().optional(),
  enabled: z.boolean().optional(),
});

const appConfigSchema = z.object({
  google_oauth: z.boolean().optional(),
  github_oauth: z.boolean().optional(),
  email_auth: z.boolean().optional(),
  custom_oauth_providers: z.array(customProviderSchema).optional(),
});

export interface PrivyAppLogins {
  methods: PrivyLoginMethod[];
  microsoftProvider: string | null;
}

function isMicrosoft(name: string | undefined): boolean {
  return name !== undefined && /microsoft/i.test(name);
}

function microsoftProviderOf(providers: readonly z.infer<typeof customProviderSchema>[]): string | null {
  const found = providers.find((p) => p.enabled === true && (isMicrosoft(p.provider) || isMicrosoft(p.provider_display_name)));
  return found?.provider ?? null;
}

export function privyAppLogins(raw: unknown): PrivyAppLogins {
  const config = parseOrThrow('privy.appConfig', appConfigSchema, raw);
  const microsoftProvider = microsoftProviderOf(config.custom_oauth_providers ?? []);
  const methods: PrivyLoginMethod[] = [];
  if (config.google_oauth === true) methods.push('google');
  if (microsoftProvider !== null) methods.push('microsoft');
  if (config.github_oauth === true) methods.push('github');
  if (config.email_auth === true) methods.push('email');
  return { methods, microsoftProvider };
}
