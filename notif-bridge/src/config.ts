import { existsSync, readFileSync } from 'node:fs';

export interface FcmServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

export interface BridgeConfig {
  xmtpPrivateKey: string;
  xmtpEnv: 'production' | 'dev' | 'local';
  xmtpDbPath: string;
  dbEncryptionKey: Uint8Array | null;
  fcm: FcmServiceAccount | null;
  tokensPath: string;
  syncMs: number;
  accountId: string;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`missing required env ${name}`);
  return v.trim();
}

function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : fallback;
}

function loadFcm(): FcmServiceAccount | null {
  const inline = process.env.FCM_SERVICE_ACCOUNT_JSON;
  const path = process.env.FCM_SERVICE_ACCOUNT_PATH;
  let raw: string | null = null;
  if (inline && inline.trim().length > 0) raw = inline;
  else if (path && existsSync(path)) raw = readFileSync(path, 'utf8');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FcmServiceAccount>;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      project_id: parsed.project_id,
      token_uri: parsed.token_uri ?? 'https://oauth2.googleapis.com/token',
    };
  } catch {
    return null;
  }
}

function loadDbKey(): Uint8Array | null {
  const hex = process.env.BRIDGE_XMTP_DB_KEY;
  if (!hex || hex.trim().length === 0) return null;
  const clean = hex.trim().replace(/^0x/, '');
  if (clean.length !== 64) throw new Error('BRIDGE_XMTP_DB_KEY must be 32 bytes (64 hex chars)');
  return Uint8Array.from(Buffer.from(clean, 'hex'));
}

function normalizeEnv(raw: string): 'production' | 'dev' | 'local' {
  if (raw === 'production' || raw === 'dev' || raw === 'local') return raw;
  throw new Error(`BRIDGE_XMTP_ENV must be production|dev|local (got ${raw})`);
}

export function loadConfig(): BridgeConfig {
  return {
    xmtpPrivateKey: req('BRIDGE_XMTP_PRIVATE_KEY'),
    xmtpEnv: normalizeEnv(opt('BRIDGE_XMTP_ENV', 'production')),
    xmtpDbPath: opt('BRIDGE_XMTP_DB_PATH', './data/xmtp.db3'),
    dbEncryptionKey: loadDbKey(),
    fcm: loadFcm(),
    tokensPath: opt('BRIDGE_TOKENS_PATH', './data/push-tokens.json'),
    syncMs: Number(opt('BRIDGE_SYNC_MS', '15000')),
    accountId: opt('BRIDGE_ACCOUNT_ID', 'bridge'),
  };
}
