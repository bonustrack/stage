export const METRO_CTRL_PREFIX = 'METRO_CTRL:';
export const CTRL_REGISTER_PUSH = 'register-push';
export const CTRL_DISABLE_PUSH = 'disable-push';

export interface RegisterPushPayload {
  v?: number;
  token: string;
  platform?: string;
  address?: string;
  inboxId?: string;
}

export interface DisablePushPayload {
  v?: number;
  token: string;
  address?: string;
  inboxId?: string;
}

export type ParsedControl =
  | { verb: typeof CTRL_REGISTER_PUSH; payload: RegisterPushPayload }
  | { verb: typeof CTRL_DISABLE_PUSH; payload: DisablePushPayload }
  | { verb: string; payload: null };

export function isControlBody(text: unknown): text is string {
  return typeof text === 'string' && text.startsWith(METRO_CTRL_PREFIX);
}

function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && token.length >= 20;
}

export function parseControlBody(body: string): ParsedControl | null {
  if (!isControlBody(body)) return null;
  const rest = body.slice(METRO_CTRL_PREFIX.length);
  const sep = rest.indexOf(':');
  const verb = sep === -1 ? rest : rest.slice(0, sep);
  const arg = sep === -1 ? '' : rest.slice(sep + 1);
  if (verb === CTRL_REGISTER_PUSH) {
    try {
      const obj = JSON.parse(arg) as Partial<RegisterPushPayload>;
      if (!isValidToken(obj?.token)) return { verb, payload: null };
      return {
        verb: CTRL_REGISTER_PUSH,
        payload: {
          v: typeof obj.v === 'number' ? obj.v : undefined,
          token: obj.token,
          platform: typeof obj.platform === 'string' ? obj.platform : undefined,
          address: typeof obj.address === 'string' ? obj.address : undefined,
          inboxId: typeof obj.inboxId === 'string' ? obj.inboxId : undefined,
        },
      };
    } catch {
      return { verb, payload: null };
    }
  }
  if (verb === CTRL_DISABLE_PUSH) {
    try {
      const obj = JSON.parse(arg) as Partial<DisablePushPayload>;
      if (!isValidToken(obj?.token)) return { verb, payload: null };
      return {
        verb: CTRL_DISABLE_PUSH,
        payload: {
          v: typeof obj.v === 'number' ? obj.v : undefined,
          token: obj.token,
          address: typeof obj.address === 'string' ? obj.address : undefined,
          inboxId: typeof obj.inboxId === 'string' ? obj.inboxId : undefined,
        },
      };
    } catch {
      return { verb, payload: null };
    }
  }
  return { verb, payload: null };
}
