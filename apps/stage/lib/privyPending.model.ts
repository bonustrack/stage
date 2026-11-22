import { isPrivyLoginMethod } from '@stage-labs/client/accounts/privy';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import type { PrivyLoginPurpose } from './privy.types';

const PENDING_TTL_MS = 15 * 60_000;

export interface PendingPrivyLogin {
  method: PrivyLoginMethod;
  purpose: PrivyLoginPurpose;
  at: number;
}

function pendingLoginOf(value: Partial<PendingPrivyLogin>, now: number): PendingPrivyLogin | null {
  if (!isPrivyLoginMethod(value.method)) return null;
  if (value.purpose !== 'login' && value.purpose !== 'reauth') return null;
  if (typeof value.at !== 'number' || value.at > now || now - value.at > PENDING_TTL_MS) return null;
  return { method: value.method, purpose: value.purpose, at: value.at };
}

export function parsePendingLogin(raw: string | null, now: number): PendingPrivyLogin | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingPrivyLogin> | null;
    return value === null || typeof value !== 'object' ? null : pendingLoginOf(value, now);
  } catch {
    return null;
  }
}
