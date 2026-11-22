import { installCredentiallessFrames } from './credentiallessFrames.web';
import { makeWalletConnect } from './walletConnect.core';

installCredentiallessFrames();

const origin = window.location.origin;

export const { connectWalletConnect, walletConnectProvider, disconnectWalletConnect } = makeWalletConnect({
  openWallet: null,
  appUrl: /^https?:\/\//.test(origin) ? origin : null,
});
