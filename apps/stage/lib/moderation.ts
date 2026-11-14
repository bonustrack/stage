import { enqueueDm, flushDmOutboxFor } from './dmOutbox';
import { acceptRequestConv, blockRequestConv, findExistingDmWithAddress, getConvConsentState, openDmWithAddress } from './xmtp.conv';

export const MODERATION_ADDRESS = '0x31a7B357d97156Fdeb36086e7205A36A8444A12C';

export type ReportDelivery = 'sent' | 'queued';

export async function sendReport(text: string): Promise<ReportDelivery> {
  await enqueueDm(MODERATION_ADDRESS, text);
  return (await flushDmOutboxFor(MODERATION_ADDRESS)) === null ? 'queued' : 'sent';
}

export async function isPersonBlocked(address: string): Promise<boolean> {
  const dm = await findExistingDmWithAddress(address);
  return dm !== null && (await getConvConsentState(dm.convId)) === 'denied';
}

export async function blockPerson(address: string): Promise<void> {
  const existing = await findExistingDmWithAddress(address);
  await blockRequestConv(existing?.convId ?? (await openDmWithAddress(address)));
}

export async function unblockPerson(address: string): Promise<void> {
  const existing = await findExistingDmWithAddress(address);
  if (existing) await acceptRequestConv(existing.convId);
}
