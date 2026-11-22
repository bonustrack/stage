import { describe, expect, test } from 'bun:test';
import { redirectSystemPath } from '../app/+native-intent';
import { loginMethodsFor, socialsFrom, type PrivySupport } from '../lib/privyMethods.model';
import { parsePendingLogin } from '../lib/privyPending.model';
import { arrayParamsProvider, isEmbeddedClient, sameAddress, switchTargetOf, switchingProvider } from '../lib/privyProvider.model';
import { hashQuery, oauthReturnOf, withOAuthReturn } from '../lib/privyReturn.model';
import { sessionAddresses, sessionChains, sessionProvider } from '../lib/walletConnect.model';
import { makeWatched } from '../lib/watched';

const WEB: PrivySupport = {
  privyApp: true,
  walletFeature: true,
  socials: ['google', 'microsoft'],
  web: true,
  extension: false,
  desktop: false,
  isolatedPage: true,
  credentiallessFrames: true,
  walletConnect: false,
};

describe('loginMethodsFor', () => {
  test('the web offers every method when the Privy wallet frame can load', () => {
    expect(loginMethodsFor(WEB)).toEqual(['google', 'microsoft', 'wallet']);
    expect(loginMethodsFor({ ...WEB, isolatedPage: false, credentiallessFrames: false })).toEqual(['google', 'microsoft', 'wallet']);
  });

  test('Google and Microsoft need the Privy app, the wallet does not', () => {
    expect(loginMethodsFor({ ...WEB, privyApp: false })).toEqual(['wallet']);
    expect(loginMethodsFor({ ...WEB, credentiallessFrames: false })).toEqual(['wallet']);
  });

  test('shows the social logins the build lists, Google alone by default', () => {
    expect(loginMethodsFor({ ...WEB, socials: socialsFrom(undefined) })).toEqual(['google', 'wallet']);
    expect(loginMethodsFor({ ...WEB, socials: socialsFrom(' github, Google ,apple') })).toEqual(['google', 'github', 'wallet']);
    expect(socialsFrom('')).toEqual([]);
  });

  test('email is listed like a social login, after them and before the web3 wallet', () => {
    expect(loginMethodsFor({ ...WEB, socials: socialsFrom('email,google,github') })).toEqual(['google', 'github', 'email', 'wallet']);
  });

  test('a build without the wallet hides the web3 wallet', () => {
    expect(loginMethodsFor({ ...WEB, walletFeature: false })).toEqual(['google', 'microsoft']);
  });

  test('the desktop app and the extension have no browser wallets, so the wallet needs WalletConnect', () => {
    for (const shell of [{ desktop: true }, { extension: true }]) {
      expect(loginMethodsFor({ ...WEB, ...shell })).toEqual([]);
      expect(loginMethodsFor({ ...WEB, ...shell, walletConnect: true })).toEqual(['wallet']);
    }
  });

  test('a phone needs a WalletConnect project for the web3 wallet', () => {
    const phone = { ...WEB, web: false, isolatedPage: false, credentiallessFrames: false };
    expect(loginMethodsFor(phone)).toEqual(['google', 'microsoft']);
    expect(loginMethodsFor({ ...phone, walletConnect: true })).toEqual(['google', 'microsoft', 'wallet']);
  });
});

describe('parsePendingLogin', () => {
  const now = 1_800_000_000_000;
  const stored = (value: unknown): string => JSON.stringify(value);

  test('reads a fresh marker', () => {
    expect(parsePendingLogin(stored({ method: 'google', purpose: 'login', at: now - 1000 }), now)).toEqual({
      method: 'google',
      purpose: 'login',
      at: now - 1000,
    });
  });

  test('drops a stale, future or malformed marker', () => {
    expect(parsePendingLogin(stored({ method: 'google', purpose: 'login', at: now - 16 * 60_000 }), now)).toBeNull();
    expect(parsePendingLogin(stored({ method: 'google', purpose: 'login', at: now + 1 }), now)).toBeNull();
    expect(parsePendingLogin(stored({ method: 'apple', purpose: 'login', at: now }), now)).toBeNull();
    expect(parsePendingLogin(stored({ method: 'google', purpose: 'other', at: now }), now)).toBeNull();
    expect(parsePendingLogin('not json', now)).toBeNull();
    expect(parsePendingLogin('null', now)).toBeNull();
    expect(parsePendingLogin(null, now)).toBeNull();
  });
});

describe('wallet providers', () => {
  test('reads the chain a wallet is asked to switch to', () => {
    expect(switchTargetOf([{ chainId: '0x2105' }])).toBe(8453);
    expect(switchTargetOf([{ chainId: '8453' }])).toBeNull();
    expect(switchTargetOf([])).toBeNull();
    expect(switchTargetOf(undefined)).toBeNull();
  });

  test('compares addresses without case and tells embedded wallets apart', () => {
    expect(sameAddress('0xAbC', '0xabc')).toBe(true);
    expect(sameAddress('0xabc', null)).toBe(false);
    expect(isEmbeddedClient('privy')).toBe(true);
    expect(isEmbeddedClient('privy-v2')).toBe(true);
    expect(isEmbeddedClient('metamask')).toBe(false);
  });

  test('passes only array params to an SDK provider', async () => {
    const seen: unknown[] = [];
    const provider = arrayParamsProvider({
      request: (request) => {
        seen.push(request);
        return Promise.resolve('ok');
      },
    });
    await provider.request({ method: 'personal_sign', params: ['0x01', '0xabc'] });
    await provider.request({ method: 'eth_chainId' });
    expect(seen).toEqual([{ method: 'personal_sign', params: ['0x01', '0xabc'] }, { method: 'eth_chainId' }]);
  });

  test('switches chains through the wallet and asks for a fresh provider afterwards', async () => {
    const switched: number[] = [];
    let providers = 0;
    const provider = switchingProvider({
      switchChain: (chainId) => {
        switched.push(chainId);
        return Promise.resolve();
      },
      getProvider: () => {
        providers += 1;
        const made = providers;
        return Promise.resolve({ request: () => Promise.resolve(made) });
      },
    });
    expect(await provider.request({ method: 'eth_chainId' })).toBe(1);
    expect(await provider.request({ method: 'eth_chainId' })).toBe(1);
    expect(await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] })).toBeNull();
    expect(switched).toEqual([1]);
    expect(await provider.request({ method: 'eth_chainId' })).toBe(2);
    expect(provider.request({ method: 'wallet_switchEthereumChain', params: [{}] })).rejects.toThrow('not valid');
  });
});

describe('sign-in return', () => {
  test('needs all three fields', () => {
    expect(oauthReturnOf('?privy_oauth_code=c&privy_oauth_state=s&privy_oauth_provider=google')).toEqual({
      privy_oauth_code: 'c',
      privy_oauth_state: 's',
      privy_oauth_provider: 'google',
    });
    expect(oauthReturnOf('?privy_oauth_code=c&privy_oauth_state=s')).toBeNull();
    expect(oauthReturnOf('')).toBeNull();
  });

  test('also finds the fields when the provider put them after the route', () => {
    expect(hashQuery('#/signup?privy_oauth_code=c&privy_oauth_state=s&privy_oauth_provider=google')).toBe(
      '?privy_oauth_code=c&privy_oauth_state=s&privy_oauth_provider=google',
    );
    expect(hashQuery('#/signup')).toBe('');
  });

  test('puts the fields back on a URL and keeps its route', () => {
    const url = withOAuthReturn('https://stage.box/?x=1#/signup', {
      privy_oauth_code: 'c',
      privy_oauth_state: 's',
      privy_oauth_provider: 'custom:microsoft',
    });
    expect(url).toBe('https://stage.box/?x=1&privy_oauth_code=c&privy_oauth_state=s&privy_oauth_provider=custom%3Amicrosoft#/signup');
  });
});

describe('sign-in return links on phones', () => {
  const link = 'stage:///?privy_oauth_code=c&privy_oauth_state=s&privy_oauth_provider=google';

  test('a return link that arrives while the app runs does not move the screen', () => {
    expect(redirectSystemPath({ path: link, initial: false })).toBe('');
  });

  test('a return link that starts the app opens the home route', () => {
    expect(redirectSystemPath({ path: link, initial: true })).toBe('/');
  });

  test('other links are untouched', () => {
    expect(redirectSystemPath({ path: 'stage://profile/alice', initial: false })).toBe('stage://profile/alice');
  });
});

describe('WalletConnect session', () => {
  const accounts = ['eip155:8453:0xAbC', 'eip155:1:0xabc', 'solana:5eykt:So1'];

  test('lists the addresses and chains a wallet approved', () => {
    expect(sessionAddresses(accounts)).toEqual(['0xabc']);
    expect(sessionChains(accounts)).toEqual([8453, 1]);
    expect(sessionAddresses(undefined)).toEqual([]);
  });

  test('answers account and chain questions itself and sends the rest on the current chain', async () => {
    const sent: [string, string][] = [];
    const provider = sessionProvider({
      address: '0xabc',
      chains: () => sessionChains(accounts),
      request: (args, chain) => {
        sent.push([args.method, chain]);
        return Promise.resolve('0xsig');
      },
    });
    expect(await provider.request({ method: 'eth_chainId' })).toBe('0x2105');
    expect(await provider.request({ method: 'eth_accounts' })).toEqual(['0xabc']);
    expect(await provider.request({ method: 'personal_sign', params: ['0x01', '0xabc'] })).toBe('0xsig');
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
    await provider.request({ method: 'eth_sendTransaction', params: [{}] });
    expect(sent).toEqual([
      ['personal_sign', 'eip155:8453'],
      ['eth_sendTransaction', 'eip155:1'],
    ]);
  });

  test('refuses a chain the wallet did not approve', () => {
    const provider = sessionProvider({ address: '0xabc', chains: () => [8453], request: () => Promise.resolve(null) });
    expect(provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa' }] })).rejects.toMatchObject({ code: 4902 });
  });
});

describe('makeWatched', () => {
  test('resolves as soon as the value matches', async () => {
    const watched = makeWatched({ ready: false, name: '' });
    const waiting = watched.until((value) => value.ready && value.name, 1000, 'late');
    watched.set({ ready: true, name: '' });
    watched.set({ ready: true, name: 'alice' });
    expect(await waiting).toBe('alice');
    expect(await watched.until((value) => value.name, 1000, 'late')).toBe('alice');
  });

  test('rejects after the timeout or when the check throws', () => {
    const watched = makeWatched(0);
    expect(watched.until((value) => value > 0, 5, 'too slow')).rejects.toThrow('too slow');
    const failing = watched.until(
      (value) => {
        if (value === 2) throw new Error('broken');
        return false;
      },
      1000,
      'late',
    );
    watched.set(2);
    expect(failing).rejects.toThrow('broken');
  });
});
