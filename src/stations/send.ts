/** One-shot post to any metro line. Caller needs the relevant env token; no daemon required. */

import { DiscordStation } from './discord/index.js';
import { GitHubStation } from './github/index.js';
import { TelegramStation } from './telegram/index.js';
import * as Line from './line.js';
import { asLine, type Line as LineT } from './types.js';

type Sender = { send(line: LineT, text: string): Promise<string> };
const SENDERS: Record<string, () => Sender> = {
  discord: () => new DiscordStation(),
  telegram: () => new TelegramStation(),
  github: () => new GitHubStation(),
};

export async function sendToLine(to: string, text: string): Promise<{ line: LineT; messageId: string }> {
  const line = asLine(to);
  const factory = SENDERS[Line.station(line) ?? ''];
  if (!factory) throw new Error(`unknown station in line "${to}" (try metro://{discord|telegram|github}/...)`);
  const messageId = await factory().send(line, text);
  return { line, messageId };
}
