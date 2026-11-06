import { clientSdk } from './xmtp.clientSdk';
import { clientSlot } from './xmtp.state';
import { appClientLifecycle } from './xmtp.clientLifecycle';

export const {
  xmtpClient,
  switchToAccount,
  deleteAccount,
  resetActiveXmtpStore,
  cachedSelfEthAddress,
  selfEthAddress,
  syncPreferences,
  listXmtpInstallations,
  revokeXmtpInstallation,
} = appClientLifecycle(clientSdk, clientSlot);
