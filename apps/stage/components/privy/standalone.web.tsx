import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PrivyProvider,
  useCreateWallet,
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
  useWallets,
  type PrivyClientConfig,
} from '@privy-io/react-auth';
import { base, mainnet, sepolia } from 'viem/chains';
import { report } from '../../lib/errorPolicy';
import { makeWatched } from '../../lib/watched';
import { publishPrivyRuntime, type PrivyRuntimeHost } from './runtimeHost';
import { makeWebPrivyController, type WebPrivyActions, type WebPrivyState } from './webController';

const DESKTOP_OAUTH_WAIT_MS = 180_000;
const ROOT_ID = 'stage-privy-root';

const INITIAL: WebPrivyState = {
  ready: false,
  authenticated: false,
  user: null,
  wallets: [],
  walletsReady: false,
  oauth: { status: 'initial' },
};

function leavePage(desktop: boolean): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (!desktop) return;
    setTimeout(() => {
      reject(new Error('Finish signing in in your browser. Stage continues when you come back.'));
    }, DESKTOP_OAUTH_WAIT_MS);
  });
}

function PrivyBridge({ host }: { host: PrivyRuntimeHost }): null {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { initOAuth, state: oauth } = useLoginWithOAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { createWallet } = useCreateWallet();
  const [state] = useState(() => makeWatched<WebPrivyState>(INITIAL));
  const actions = useRef<WebPrivyActions | null>(null);
  const current: WebPrivyActions = {
    initOAuth: (provider) => initOAuth({ provider }),
    sendEmailCode: (email) => sendCode({ email }),
    loginWithEmailCode: (code) => loginWithCode({ code }),
    logout,
    createWallet,
  };
  useEffect(() => {
    actions.current = current;
    state.set({ ready, authenticated, user, wallets, walletsReady, oauth });
  });
  useEffect(() => {
    let returned = host.returned;
    return host.register(
      makeWebPrivyController({
        state,
        actions: () => {
          if (actions.current === null) throw new Error('Sign-in is not ready. Try again.');
          return actions.current;
        },
        takeReturn: () => {
          const taken = returned;
          returned = false;
          return taken;
        },
        leave: () => leavePage(host.desktop),
        host,
      }),
    );
  }, [state, host]);
  return null;
}

function configFor(host: PrivyRuntimeHost): PrivyClientConfig {
  return {
    appearance: { theme: host.dark ? 'dark' : 'light', ...(host.accent === undefined ? {} : { accentColor: host.accent }) },
    embeddedWallets: { ethereum: { createOnLogin: 'off' }, showWalletUIs: false },
    defaultChain: base,
    supportedChains: [base, mainnet, sepolia],
    ...(host.oauthRedirectUrl === undefined ? {} : { customOAuthRedirectUrl: host.oauthRedirectUrl }),
    allowOAuthInEmbeddedBrowsers: host.desktop,
  };
}

function mount(host: PrivyRuntimeHost): void {
  if (document.getElementById(ROOT_ID) !== null) return;
  const container = document.createElement('div');
  container.id = ROOT_ID;
  document.body.appendChild(container);
  const crashed = (error: unknown): void => {
    report('privy.runtime', error);
    container.remove();
    host.failed(new Error('Sign-in stopped working. Try again.'));
  };
  createRoot(container, { onUncaughtError: crashed }).render(
    <PrivyProvider appId={host.appId} clientId={host.clientId} config={configFor(host)}>
      <PrivyBridge host={host} />
    </PrivyProvider>,
  );
}

publishPrivyRuntime({ mount });
