import '@privy-io/expo/polyfills';
import { useEffect, useRef, useState } from 'react';
import { PrivyProvider, useEmbeddedEthereumWallet, useLoginWithEmail, useLoginWithOAuth, usePrivy } from '@privy-io/expo';
import { base, mainnet, sepolia } from 'viem/chains';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID, privyOAuthProvider } from '../../lib/privyConfig';
import { registerPrivyController } from '../../lib/privyBridge';
import { makeWatched } from '../../lib/watched';
import { makeNativePrivyController, type NativePrivyActions, type NativePrivyState } from './nativeController';

const INITIAL: NativePrivyState = { ready: false, user: null, wallets: [] };

function PrivyBridge(): null {
  const { user, isReady, logout } = usePrivy();
  const { wallets, create } = useEmbeddedEthereumWallet();
  const { login } = useLoginWithOAuth();
  const email = useLoginWithEmail();
  const [state] = useState(() => makeWatched<NativePrivyState>(INITIAL));
  const actions = useRef<NativePrivyActions | null>(null);
  const current: NativePrivyActions = {
    oauth: (provider) => login({ provider }),
    sendEmailCode: (address) => email.sendCode({ email: address }),
    loginWithEmailCode: (address, code) => email.loginWithCode({ email: address, code }),
    logout,
    createWallet: () => create(),
  };
  useEffect(() => {
    actions.current = current;
    state.set({ ready: isReady, user, wallets });
  });
  useEffect(
    () =>
      registerPrivyController(
        makeNativePrivyController({
          state,
          actions: () => {
            if (actions.current === null) throw new Error('Sign-in is not ready. Try again.');
            return actions.current;
          },
          oauthProvider: privyOAuthProvider,
        }),
      ),
    [state],
  );
  return null;
}

export function PrivyRuntime(): React.ReactElement | null {
  if (PRIVY_APP_ID === undefined) return null;
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID} supportedChains={[base, mainnet, sepolia]}>
      <PrivyBridge />
    </PrivyProvider>
  );
}
