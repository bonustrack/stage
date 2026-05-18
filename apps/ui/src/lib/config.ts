/** Persisted config — daemon URL, bearer token, self URI. localStorage on web. */

export interface Config {
  daemonUrl: string;
  token: string;
  userId: string;
}

const KEYS = {
  daemonUrl: 'metro_daemon_url',
  token: 'metro_bearer_token',
  userId: 'metro_user_id',
} as const;

export function loadConfig(): Config {
  return {
    daemonUrl: localStorage.getItem(KEYS.daemonUrl) ?? '',
    token: localStorage.getItem(KEYS.token) ?? '',
    userId: localStorage.getItem(KEYS.userId) ?? '',
  };
}

export function saveConfig(cfg: Config): void {
  localStorage.setItem(KEYS.daemonUrl, cfg.daemonUrl.trim());
  localStorage.setItem(KEYS.token, cfg.token.trim());
  localStorage.setItem(KEYS.userId, cfg.userId.trim());
}

export function isConfigured(cfg: Config): boolean {
  return !!cfg.daemonUrl && !!cfg.token;
}
