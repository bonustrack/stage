
import type { XmtpEnv } from '@xmtp/browser-sdk';
import {
  getActiveAccount, getActiveAccountId as getActiveAccountIdRaw,
  type AccountRecord,
} from './accounts';
import {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroConvIdOf, metroDmPeerOf,
} from '@stage-labs/client/xmtp/line';
import { shortAddress } from '@stage-labs/client/identity/format';

export type { XmtpEnv };

export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroConvIdOf, metroDmPeerOf,
  shortAddress,
};

export {
  listAccounts, bumpAccountEpoch,
  addGeneratedAccount, importPrivateKey, importFromSeed, accountEpoch,
  addSmartAccount, smartAccountsConfigured,
  getWalletMnemonic, hasWalletMnemonic, restoreWalletMnemonic,
} from './accounts';
export { getActiveAccount };
export type { AccountRecord };

export function getActiveAccountId(): Promise<string | null> {
  return getActiveAccountIdRaw();
}

export type {
  XmtpClient, XmtpInstallationView, XmtpAccountInfo,
} from './xmtpClient';
export {
  getOrCreateXmtpClient, switchToAccount, removeAccount,
  getCachedXmtpClient, getXmtpEnv, getXmtpAccountInfo, convOfLine,
} from './xmtpClient';

export function stampAvatarUrl(address: string, size = 120, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}

export { peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap } from './xmtpResolve';

export {
  ASK_QUESTION_MEMBERS, METRO_API_URL,
  createAskQuestionGroup, openDmWithAddress,
  createGroup, addGroupMembers,
} from './xmtpGroups';

export {
  getLastReadNs, setLastReadNs,
  getConvConsent, markConvReadSynced, markConvUnreadSynced,
  syncPreferences, streamConvConsent,
} from './xmtpConsent';
