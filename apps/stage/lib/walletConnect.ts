import '@walletconnect/react-native-compat';
import { Linking } from 'react-native';
import { ignored } from './errorPolicy';
import { makeWalletConnect } from './walletConnect.core';

export const { connectWalletConnect, walletConnectProvider, disconnectWalletConnect } = makeWalletConnect({
  openWallet: (link) => {
    void Linking.openURL(link).catch(ignored(undefined, 'optional'));
  },
  appUrl: null,
});
