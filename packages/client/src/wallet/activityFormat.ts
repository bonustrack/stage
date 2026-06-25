import type { ActivityRow } from '../api/etherscan';
import { shortAddress } from '../identity/format';
import { getPeerName } from '../identity/peerProfiles';

export function txTitle(r: ActivityRow): string {
  if (r.isContract) return r.functionName || 'Contract';
  if (r.direction === 'receive') return 'Received';
  if (r.direction === 'self') return 'Self';
  return 'Sent';
}

export function txPartyLabel(r: ActivityRow): string {
  const name = getPeerName(r.counterparty) ?? shortAddress(r.counterparty);
  return r.direction === 'receive' ? `From ${name}` : `To ${name}`;
}

export function relTime(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
