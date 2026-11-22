import { UniversalProvider, type RequestArguments } from '@walletconnect/universal-provider';
import { shortAddress } from '@stage-labs/client/identity/format';
import { ignored } from './errorPolicy';
import { WALLETCONNECT_PROJECT_ID } from './privyConfig';
import type { Eip1193Provider } from './privy.types';
import { SignInCancelled } from './signInCancelled';
import { onPairingCancel, showPairingUri } from './walletConnectPairing';
import { makeDeferred } from './watched';
import {
  WALLETCONNECT_CHAINS,
  WALLETCONNECT_EVENTS,
  WALLETCONNECT_METHODS,
  caipChain,
  sessionAddresses,
  sessionChains,
  sessionProvider,
} from './walletConnect.model';

const SITE = 'https://stage.box';

function metadataFor(appUrl: string) {
  return {
    name: 'Stage',
    description: 'Private, encrypted messenger',
    url: appUrl,
    icons: [`${SITE}/favicon.svg`],
    redirect: { native: 'stage://' },
  };
}

type WalletConnectClient = InstanceType<typeof UniversalProvider>;

export interface WalletConnectPort {
  openWallet: ((link: string) => void) | null;
  appUrl: string | null;
}

export interface WalletConnectApi {
  connectWalletConnect: () => Promise<string>;
  walletConnectProvider: (address: string) => Promise<Eip1193Provider>;
  disconnectWalletConnect: (address: string) => Promise<void>;
}

function accountsOf(provider: WalletConnectClient): readonly string[] | undefined {
  return provider.session?.namespaces.eip155?.accounts;
}

export function makeWalletConnect(port: WalletConnectPort): WalletConnectApi {
  let client: Promise<WalletConnectClient> | null = null;

  async function createClient(): Promise<WalletConnectClient> {
    if (WALLETCONNECT_PROJECT_ID === undefined) throw new Error('This build has no WalletConnect project.');
    const provider = await UniversalProvider.init({ projectId: WALLETCONNECT_PROJECT_ID, metadata: metadataFor(port.appUrl ?? SITE) });
    provider.on('display_uri', (uri: string) => {
      showPairingUri(uri);
    });
    return provider;
  }

  function walletConnect(): Promise<WalletConnectClient> {
    client ??= createClient().catch((err: unknown) => {
      client = null;
      throw err;
    });
    return client;
  }

  async function connectWalletConnect(): Promise<string> {
    const provider = await walletConnect();
    if (provider.session !== undefined) await provider.disconnect().catch(ignored(undefined, 'cleanup'));
    const cancelled = makeDeferred<never>();
    onPairingCancel(() => {
      cancelled.reject(new SignInCancelled());
    });
    try {
      const eip155 = {
        chains: WALLETCONNECT_CHAINS.map(caipChain),
        methods: [...WALLETCONNECT_METHODS],
        events: [...WALLETCONNECT_EVENTS],
      };
      await Promise.race([provider.connect({ optionalNamespaces: { eip155 } }), cancelled.promise]);
    } finally {
      onPairingCancel(null);
      showPairingUri(null);
    }
    const [address] = sessionAddresses(accountsOf(provider));
    if (address === undefined) throw new Error('The wallet did not share an account.');
    return address;
  }

  function openWallet(provider: WalletConnectClient): void {
    const link = provider.session?.peer.metadata.redirect?.native;
    if (link && port.openWallet !== null) port.openWallet(link);
  }

  async function walletConnectProvider(address: string): Promise<Eip1193Provider> {
    const provider = await walletConnect();
    const wanted = address.toLowerCase();
    if (!sessionAddresses(accountsOf(provider)).includes(wanted) && (await connectWalletConnect()) !== wanted) {
      throw new Error(`Connect the wallet you signed in with (${shortAddress(address)}).`);
    }
    return sessionProvider({
      address,
      chains: () => sessionChains(accountsOf(provider)),
      request: (args, chain) => {
        openWallet(provider);
        return provider.request(args as RequestArguments, chain);
      },
    });
  }

  async function disconnectWalletConnect(address: string): Promise<void> {
    const provider = await walletConnect();
    if (sessionAddresses(accountsOf(provider)).includes(address.toLowerCase())) await provider.disconnect();
  }

  return { connectWalletConnect, walletConnectProvider, disconnectWalletConnect };
}
