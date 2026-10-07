import { getAddress, isAddress, zeroAddress } from 'viem';

const CONTACT_PREFIX = 'stage://profile/';

function publicAddress(value: string): string | null {
  return isAddress(value) && value.toLowerCase() !== zeroAddress ? getAddress(value) : null;
}

export function contactQrValue(address: string | null | undefined): string | null {
  const valid = address ? publicAddress(address) : null;
  return valid === null ? null : `${CONTACT_PREFIX}${valid}`;
}

export function parseContactQr(value: string): string | null {
  const text = value.trim();
  const address = text.startsWith(CONTACT_PREFIX) ? text.slice(CONTACT_PREFIX.length) : text;
  return publicAddress(address);
}

export function contactScanResult(value: string, ownAddress: string, selection: number, currentSelection: number):
  { path: string; error?: never } | { error: string; path?: never } | null {
  if (selection !== currentSelection) return null;
  const address = parseContactQr(value);
  if (address === null) return { error: 'Use a Stage contact QR code or a public address.' };
  if (address.toLowerCase() === ownAddress.toLowerCase()) return { error: 'This is your own address. Scan someone else’s QR code.' };
  return { path: `/profile/${address}` };
}
