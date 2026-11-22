export const OAUTH_RETURN_KEYS = ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider'] as const;

export type OAuthReturn = Record<(typeof OAUTH_RETURN_KEYS)[number], string>;

export const DESKTOP_OAUTH_REDIRECT = 'https://stage.box/oauth.html';

export function oauthReturnOf(search: string): OAuthReturn | null {
  const params = new URLSearchParams(search);
  const [code, state, provider] = OAUTH_RETURN_KEYS.map((key) => params.get(key));
  if (!code || !state || !provider) return null;
  return { privy_oauth_code: code, privy_oauth_state: state, privy_oauth_provider: provider };
}

export function hashQuery(hash: string): string {
  const at = hash.indexOf('?');
  return at === -1 ? '' : hash.slice(at);
}

export function withOAuthReturn(href: string, values: OAuthReturn): string {
  const url = new URL(href);
  for (const key of OAUTH_RETURN_KEYS) url.searchParams.set(key, values[key]);
  return url.toString();
}
