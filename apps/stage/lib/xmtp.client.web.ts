import { clientSdk } from './xmtp.clientSdk.web';
import { clientSlot } from './xmtp.state.web';
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
