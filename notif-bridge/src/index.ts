import { loadConfig } from './config.ts';
import { createFcmSender, type FcmSender } from './fcm.ts';
import { fanOutContentless } from './push.ts';
import { CTRL_DISABLE_PUSH, CTRL_REGISTER_PUSH, parseControlBody } from './control.ts';
import { fileTokenStore, removeToken, upsertToken, type TokenStore } from './tokens.ts';
import { bootBridgeClient, runStream } from './xmtp.ts';
import type { DecodedMessage } from '@xmtp/node-sdk';

function handleControl(store: TokenStore, accountId: string, message: DecodedMessage): void {
  const body = message.content;
  if (typeof body !== 'string') return;
  const parsed = parseControlBody(body);
  if (!parsed) return;
  if (parsed.verb === CTRL_REGISTER_PUSH && parsed.payload) {
    const total = upsertToken(store, {
      token: parsed.payload.token,
      account: accountId,
      inboxId: message.senderInboxId,
      platform: parsed.payload.platform,
    });
    process.stderr.write(
      `bridge: register-push stored ${parsed.payload.token.slice(0, 12)}… (${total} total)\n`,
    );
    return;
  }
  if (parsed.verb === CTRL_DISABLE_PUSH && parsed.payload) {
    const remaining = removeToken(store, parsed.payload.token);
    process.stderr.write(
      `bridge: disable-push ${parsed.payload.token.slice(0, 12)}… ` +
        (remaining === -1 ? 'not found\n' : `removed (${remaining} remain)\n`),
    );
    return;
  }
  process.stderr.write(`bridge: control '${parsed.verb}' swallowed\n`);
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = fileTokenStore(cfg.tokensPath);
  const fcm: FcmSender | null = cfg.fcm ? createFcmSender(cfg.fcm) : null;
  if (!fcm) {
    process.stderr.write('bridge: WARNING no FCM service account configured — pushes disabled\n');
  }

  const client = await bootBridgeClient(cfg);
  process.stderr.write(`bridge: booted XMTP inbox ${client.inboxId} on ${cfg.xmtpEnv}\n`);

  await runStream(client, cfg, {
    onControl: (message) => handleControl(store, cfg.accountId, message),
    onInbound: ({ message, convId, line, isGroup }) => {
      if (!fcm) return;
      void fanOutContentless(
        store,
        fcm,
        { account: cfg.accountId, line, convId, messageId: message.id, isGroup },
        message.senderInboxId,
      ).catch((err: unknown) => {
        process.stderr.write(`bridge push error: ${(err as Error).message}\n`);
      });
    },
  });
}

void main().catch((err: unknown) => {
  process.stderr.write(`bridge fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
