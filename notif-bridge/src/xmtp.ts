import { Client, Group, IdentifierKind, type ClientOptions, type DecodedMessage, type Signer } from '@xmtp/node-sdk';
import { hexToBytes, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { BridgeConfig } from './config.ts';

const SILENT_TYPES = new Set([
  'readReceipt',
  'transactionReference',
  'walletSendCalls',
  'groupUpdated',
  'group_updated',
]);

export type BridgeClient = Awaited<ReturnType<typeof Client.create>>;

function signerFor(privateKey: string): Signer {
  const account = privateKeyToAccount(privateKey as Hex);
  return {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const sig = await account.signMessage({ message });
      return hexToBytes(sig);
    },
  };
}

export async function bootBridgeClient(cfg: BridgeConfig): Promise<BridgeClient> {
  const signer = signerFor(cfg.xmtpPrivateKey);
  const options: ClientOptions = {
    env: cfg.xmtpEnv,
    dbPath: cfg.xmtpDbPath,
    ...(cfg.dbEncryptionKey ? { dbEncryptionKey: cfg.dbEncryptionKey } : {}),
  };
  return Client.create(signer, options);
}

export interface InboundMessage {
  message: DecodedMessage;
  convId: string;
  line: string;
  isGroup: boolean;
}

export interface StreamHandlers {
  onControl: (message: DecodedMessage) => void;
  onInbound: (inbound: InboundMessage) => void;
}

export function shouldSkip(client: BridgeClient, message: DecodedMessage): boolean {
  if (message.senderInboxId === client.inboxId) return true;
  if (SILENT_TYPES.has(message.contentType?.typeId ?? '')) return true;
  return false;
}

export async function runStream(
  client: BridgeClient,
  cfg: BridgeConfig,
  handlers: StreamHandlers,
): Promise<void> {
  const { ConsentState } = await import('@xmtp/node-sdk');
  const states = [ConsentState.Allowed, ConsentState.Unknown];

  try {
    await client.conversations.syncAll(states);
    const initial = await client.conversations.list();
    process.stderr.write(`bridge: synced ${initial.length} conversation(s) at boot\n`);
  } catch (err) {
    process.stderr.write(`bridge boot sync error: ${(err as Error).message}\n`);
  }

  setInterval(() => {
    void client.conversations.syncAll(states).catch((err: unknown) => {
      process.stderr.write(`bridge sync error: ${(err as Error).message}\n`);
    });
  }, cfg.syncMs).unref();

  for (;;) {
    try {
      const stream = await client.conversations.streamAllMessages();
      for await (const message of stream) {
        if (!message) continue;
        if (typeof message.content === 'string' && message.content.startsWith('METRO_CTRL:')) {
          handlers.onControl(message);
          continue;
        }
        if (shouldSkip(client, message)) continue;
        const conv = await client.conversations.getConversationById(message.conversationId);
        if (!conv) continue;
        const isGroup = conv instanceof Group;
        handlers.onInbound({
          message,
          convId: conv.id,
          line: `metro://xmtp/${cfg.accountId}/${conv.id}`,
          isGroup,
        });
      }
    } catch (err) {
      process.stderr.write(`bridge stream error (retry 5s): ${(err as Error).message}\n`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}
