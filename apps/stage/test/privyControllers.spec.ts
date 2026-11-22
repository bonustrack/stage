import { describe, expect, test } from 'bun:test';
import {
  makeNativePrivyController,
  type NativePrivyActions,
  type NativePrivyState,
  type NativePrivyUser,
} from '../components/privy/nativeController';
import {
  makeWebPrivyController,
  type WebPrivyActions,
  type WebPrivyState,
  type WebPrivyUser,
  type WebPrivyWallet,
} from '../components/privy/webController';
import { makeWatched } from '../lib/watched';

const EMBEDDED = '0x1111111111111111111111111111111111111111';
const EXTERNAL = '0x2222222222222222222222222222222222222222';
const NEVER = new Promise<never>(() => undefined);

function webWallet(address: string, walletClientType: string, log: string[] = []): WebPrivyWallet {
  return {
    address,
    walletClientType,
    switchChain: (chainId) => {
      log.push(`switch:${chainId}`);
      return Promise.resolve();
    },
    getEthereumProvider: () => Promise.resolve({ request: (request) => Promise.resolve(`${walletClientType}:${request.method}`) }),
  };
}

const googleUser = (withWallet: boolean): WebPrivyUser => ({
  linkedAccounts: [
    { type: 'google_oauth' },
    ...(withWallet ? [{ type: 'wallet', address: EMBEDDED, chainType: 'ethereum', walletClientType: 'privy' }] : []),
  ],
});

const READY: WebPrivyState = {
  ready: true,
  authenticated: false,
  user: null,
  wallets: [],
  walletsReady: true,
  oauth: { status: 'initial' },
};

function webHarness(initial: WebPrivyState, returned = false) {
  const state = makeWatched(initial);
  const log: string[] = [];
  const actions: WebPrivyActions = {
    initOAuth: (provider) => {
      log.push(`oauth:${provider}`);
      return Promise.resolve();
    },
    logout: () => {
      log.push('logout');
      state.set({ ...state.get(), authenticated: false, user: null });
      return Promise.resolve();
    },
    createWallet: () => {
      log.push('createWallet');
      state.set({ ...state.get(), user: googleUser(true) });
      return Promise.resolve();
    },
  };
  let pendingReturn = returned;
  const controller = makeWebPrivyController({
    state,
    actions: () => actions,
    takeReturn: () => {
      const taken = pendingReturn;
      pendingReturn = false;
      return taken;
    },
    leave: () => {
      log.push('leave');
      return NEVER;
    },
    host: {
      oauthProvider: (method) => (method === 'google' ? 'google' : 'custom:microsoft'),
      linkedType: (method) => (method === 'google' ? 'google_oauth' : 'custom:microsoft'),
      pending: {
        write: (method, purpose) => {
          log.push(`pending:${method}:${purpose}`);
          return Promise.resolve();
        },
        clear: () => {
          log.push('pending:clear');
          return Promise.resolve();
        },
      },
    },
    reconnectMs: 10,
  });
  return { state, log, controller };
}

async function settled(log: string[], entry: string): Promise<void> {
  for (let i = 0; i < 50 && !log.includes(entry); i++) await Promise.resolve();
}

describe('web sign-in', () => {
  test('a social sign-in ends the old session, remembers the attempt and leaves for the provider', async () => {
    const h = webHarness({ ...READY, authenticated: true, user: googleUser(true) });
    void h.controller.login('microsoft', 'login');
    await settled(h.log, 'leave');
    expect(h.log).toEqual(['logout', 'pending:microsoft:login', 'oauth:custom:microsoft', 'leave']);
  });

  test('coming back from the provider finishes the sign-in and creates the wallet once', async () => {
    const h = webHarness({ ...READY, oauth: { status: 'loading' } }, true);
    const login = h.controller.login('google', 'login');
    h.state.set({ ...h.state.get(), authenticated: true, user: googleUser(false), oauth: { status: 'done' } });
    expect(await login).toEqual({ address: EMBEDDED, method: 'google' });
    expect(h.log).toEqual(['pending:clear', 'createWallet']);
  });

  test('a returning user keeps the wallet they already have', async () => {
    const h = webHarness({ ...READY, authenticated: true, user: googleUser(true), oauth: { status: 'done' } }, true);
    expect(await h.controller.login('google', 'login')).toEqual({ address: EMBEDDED, method: 'google' });
    expect(h.log).toEqual(['pending:clear']);
  });

  test('a failed return reports the provider error and forgets the attempt', async () => {
    const h = webHarness({ ...READY, oauth: { status: 'error', error: new Error('access denied') } }, true);
    expect(h.controller.login('google', 'login')).rejects.toThrow('access denied');
    await settled(h.log, 'pending:clear');
    expect(h.log).toEqual(['pending:clear']);
  });

  test('a return for another method is refused', async () => {
    const h = webHarness({ ...READY, authenticated: true, user: googleUser(true), oauth: { status: 'done' } }, true);
    expect(h.controller.login('microsoft', 'login')).rejects.toThrow('Microsoft');
  });
});

describe('web signer', () => {
  test('uses the embedded wallet of the signed-in user and switches chains through it', async () => {
    const log: string[] = [];
    const h = webHarness({ ...READY, authenticated: true, user: googleUser(true), wallets: [webWallet(EMBEDDED, 'privy', log)] });
    const provider = await h.controller.provider({ address: EMBEDDED, method: 'google' });
    expect(await provider.request({ method: 'personal_sign', params: [] })).toBe('privy:personal_sign');
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
    expect(log).toEqual(['switch:8453']);
  });

  test('an embedded wallet without its Privy session asks to sign in again', () => {
    const h = webHarness(READY);
    expect(h.controller.provider({ address: EMBEDDED, method: 'google' })).rejects.toThrow('Sign in with Google again');
  });

  test('forgetting an account logs out of Privy only when the session is that account', async () => {
    const h = webHarness({ ...READY, authenticated: true, user: googleUser(true) });
    await h.controller.forget({ address: EXTERNAL, method: 'microsoft' });
    expect(h.log).toEqual([]);
    await h.controller.forget({ address: EMBEDDED, method: 'google' });
    expect(h.log).toEqual(['logout']);
  });
});

const nativeUser = (withWallet: boolean): NativePrivyUser => ({
  linked_accounts: [
    { type: 'google_oauth' },
    ...(withWallet ? [{ type: 'wallet', address: EMBEDDED, chain_type: 'ethereum', wallet_client_type: 'privy' }] : []),
  ],
});

function nativeHarness(initial: NativePrivyState) {
  const state = makeWatched(initial);
  const log: string[] = [];
  const embedded = { address: EMBEDDED, getProvider: () => Promise.resolve({ request: () => Promise.resolve('embedded') }) };
  const actions: NativePrivyActions = {
    oauth: (provider) => {
      log.push(`oauth:${provider}`);
      state.set({ ...state.get(), user: nativeUser(false) });
      return Promise.resolve(nativeUser(false));
    },
    logout: () => {
      log.push('logout');
      state.set({ ...state.get(), user: null, wallets: [] });
      return Promise.resolve();
    },
    createWallet: () => {
      log.push('createWallet');
      state.set({ ...state.get(), user: nativeUser(true), wallets: [embedded] });
      return Promise.resolve();
    },
  };
  const controller = makeNativePrivyController({
    state,
    actions: () => actions,
    oauthProvider: (method) => (method === 'google' ? 'google' : 'custom:microsoft'),
    reconnectMs: 10,
  });
  return { state, log, controller };
}

describe('native sign-in', () => {
  test('a social sign-in replaces the old session and creates the wallet', async () => {
    const h = nativeHarness({ ready: true, user: nativeUser(true), wallets: [] });
    expect(await h.controller.login('google', 'login')).toEqual({ address: EMBEDDED, method: 'google' });
    expect(h.log).toEqual(['logout', 'oauth:google', 'createWallet']);
  });

  test('an embedded wallet that is not loaded asks to sign in again', () => {
    const h = nativeHarness({ ready: true, user: null, wallets: [] });
    expect(h.controller.provider({ address: EMBEDDED, method: 'microsoft' })).rejects.toThrow('Sign in with Microsoft again');
  });

  test('forgetting the signed-in account logs out of Privy, another account leaves it alone', async () => {
    const h = nativeHarness({ ready: true, user: nativeUser(true), wallets: [] });
    await h.controller.forget({ address: EXTERNAL, method: 'google' });
    expect(h.log).toEqual([]);
    await h.controller.forget({ address: EMBEDDED, method: 'google' });
    expect(h.log).toEqual(['logout']);
  });
});
