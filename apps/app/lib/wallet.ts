
import './cryptoShim';
import { clearAllAccounts } from './accounts';
import { resetXmtpClient } from './xmtp.client';
import { clearMnemonic } from './zerodev/keyring';
import { setWalletBackedUp } from './walletBackup';
import { bumpAccountEpoch } from './accountEpoch';

export async function resetAccount(): Promise<void> {
  await clearAllAccounts();
}

export async function resetForOnboarding(): Promise<void> {
  await resetXmtpClient();
  await clearMnemonic();
  await setWalletBackedUp(false);
  bumpAccountEpoch();
}
