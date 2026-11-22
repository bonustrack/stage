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

const WEB_EMBEDDED_LINK = { type: 'wallet', address: EMBEDDED, chainType: 'ethereum', walletClientType: 'privy' };
const EMAIL = 'ada@example.com';
const GOOD_CODE = '123456';

const googleUser = (withWallet: boolean): WebPrivyUser => ({
  linkedAccounts: [{ type: 'google_oauth' }, ...(withWallet ? [WEB_EMBEDDED_LINK] : [])],
});

const webEmailUser = (address: string): WebPrivyUser => ({ linkedAccounts: [{ type: 'email', address }] });

const READY: WebPrivyState = {
  ready: true,
  authenticated: false,
  user: null,
  wallets: [],
  walletsReady: true,
  oauth: { status: 'initial' },
};

function webHarness(initial: WebPrivyState, returned = false, codeEmail = EMAIL) {
  const state = makeWatched(initial);
  const log: string[] = [];
  const actions: WebPrivyActions = {
    initOAuth: (provider) => {
      log.push(`oauth:${provider}`);
      return Promise.resolve();
    },
    sendEmailCode: (email) => {
      log.push(`email:${email}`);
      return Promise.resolve();
    },
    loginWithEmailCode: (code) => {
      log.push(`code:${code}`);
      if (code !== GOOD_CODE) return Promise.reject(new Error('Invalid code'));
      state.set({ ...state.get(), authenticated: true, user: webEmailUser(codeEmail) });
      return Promise.resolve();
    },
    logout: () => {
      log.push('logout');
      state.set({ ...state.get(), authenticated: false, user: null });
      return Promise.resolve();
    },
    createWallet: () => {
      log.push('createWallet');
      const linked = state.get().user?.linkedAccounts ?? googleUser(false).linkedAccounts;
      state.set({ ...state.get(), user: { linkedAccounts: [...linked, WEB_EMBEDDED_LINK] } });
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

  test('an email sign-in ends the old session, sends the code, then signs in and creates the wallet', async () => {
    const h = webHarness({ ...READY, authenticated: true, user: googleUser(true) });
    await h.controller.sendEmailCode(EMAIL);
    expect(await h.controller.loginWithEmail(EMAIL, GOOD_CODE)).toEqual({ address: EMBEDDED, method: 'email' });
    expect(h.log).toEqual(['logout', `email:${EMAIL}`, `code:${GOOD_CODE}`, 'createWallet']);
  });

  test('a wrong email code is reported and signs nobody in', () => {
    const h = webHarness(READY);
    expect(h.controller.loginWithEmail(EMAIL, '000000')).rejects.toThrow('Invalid code');
  });

  test('an email sign-in that lands on another address is refused', () => {
    const h = webHarness(READY, false, 'someone@else.com');
    expect(h.controller.loginWithEmail(EMAIL, GOOD_CODE)).rejects.toThrow('did not finish');
  });

  test('the email match ignores case and spaces', async () => {
    const h = webHarness(READY, false, ' Ada@Example.COM ');
    expect(await h.controller.loginWithEmail(EMAIL, GOOD_CODE)).toEqual({ address: EMBEDDED, method: 'email' });
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

const NATIVE_EMBEDDED_LINK = { type: 'wallet', address: EMBEDDED, chain_type: 'ethereum', wallet_client_type: 'privy' };

const nativeUser = (withWallet: boolean): NativePrivyUser => ({
  linked_accounts: [{ type: 'google_oauth' }, ...(withWallet ? [NATIVE_EMBEDDED_LINK] : [])],
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
    sendEmailCode: (email) => {
      log.push(`email:${email}`);
      return Promise.resolve({ success: true });
    },
    loginWithEmailCode: (email, code) => {
      log.push(`code:${email}:${code}`);
      if (code !== GOOD_CODE) return Promise.resolve(undefined);
      const user: NativePrivyUser = { linked_accounts: [{ type: 'email', address: email }] };
      state.set({ ...state.get(), user });
      return Promise.resolve(user);
    },
    logout: () => {
      log.push('logout');
      state.set({ ...state.get(), user: null, wallets: [] });
      return Promise.resolve();
    },
    createWallet: () => {
      log.push('createWallet');
      const linked = state.get().user?.linked_accounts ?? nativeUser(false).linked_accounts;
      state.set({ ...state.get(), user: { linked_accounts: [...linked, NATIVE_EMBEDDED_LINK] }, wallets: [embedded] });
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

  test('an email sign-in replaces the old session, checks the code and creates the wallet', async () => {
    const h = nativeHarness({ ready: true, user: nativeUser(true), wallets: [] });
    await h.controller.sendEmailCode(EMAIL);
    expect(await h.controller.loginWithEmail(EMAIL, GOOD_CODE)).toEqual({ address: EMBEDDED, method: 'email' });
    expect(h.log).toEqual(['logout', `email:${EMAIL}`, `code:${EMAIL}:${GOOD_CODE}`, 'createWallet']);
  });

  test('a wrong email code asks to check it', () => {
    const h = nativeHarness({ ready: true, user: null, wallets: [] });
    expect(h.controller.loginWithEmail(EMAIL, '000000')).rejects.toThrow('That code did not work');
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
