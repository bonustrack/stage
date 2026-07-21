import { createSign } from 'node:crypto';
import type { FcmServiceAccount } from './config.ts';

export interface FcmMessage {
  message: {
    token: string;
    android: { priority: 'HIGH' };
    data: Record<string, string>;
  };
}

export function buildContentlessMessage(
  deviceToken: string,
  data: Record<string, string>,
): FcmMessage {
  return {
    message: {
      token: deviceToken,
      android: { priority: 'HIGH' },
      data: { channelId: 'xmtp', ...data },
    },
  };
}

export function isDeadTokenResponse(status: number, body: string): boolean {
  return (
    status === 404 ||
    body.includes('UNREGISTERED') ||
    body.includes('NOT_FOUND') ||
    body.includes('registration-token-not-registered') ||
    body.includes('NotRegistered')
  );
}

function b64url(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url');
}

export interface FcmSender {
  send: (deviceToken: string, data: Record<string, string>) => Promise<'ok' | 'dead' | 'error'>;
}

export function createFcmSender(svc: FcmServiceAccount): FcmSender {
  let cached: { token: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string | null> {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: svc.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: svc.token_uri,
      iat: now,
      exp: now + 3600,
    };
    const sigInput = `${b64url(header)}.${b64url(payload)}`;
    const signer = createSign('RSA-SHA256');
    signer.update(sigInput);
    signer.end();
    const sig = signer.sign(svc.private_key).toString('base64url');
    const jwt = `${sigInput}.${sig}`;
    const grant = encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const res = await fetch(svc.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${grant}&assertion=${jwt}`,
    });
    if (!res.ok) {
      process.stderr.write(`fcm token exchange ${res.status}: ${await res.text()}\n`);
      return null;
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return cached.token;
  }

  return {
    send: async (deviceToken, data): Promise<'ok' | 'dead' | 'error'> => {
      const at = await accessToken();
      if (!at) return 'error';
      const url = `https://fcm.googleapis.com/v1/projects/${svc.project_id}/messages:send`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
        body: JSON.stringify(buildContentlessMessage(deviceToken, data)),
      });
      if (res.ok) return 'ok';
      const txt = await res.text().catch(() => '');
      if (isDeadTokenResponse(res.status, txt)) return 'dead';
      process.stderr.write(`fcm push ${res.status}: ${txt}\n`);
      return 'error';
    },
  };
}
