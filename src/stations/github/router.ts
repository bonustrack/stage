/** Map a GitHub mention to a chat-station thread + run the agent turn there. Bridges persist for continuity. */

import { errMsg, log } from '../../log.js';
import * as Line from '../line.js';
import type { ChatStation, InboundMessage, Line as LineT } from '../types.js';
import type { DiscordStation } from '../discord/index.js';
import type { GitHubMeta, GitHubStation } from './index.js';
import { getBridge, setBridge } from './bridges.js';

export type Dispatch = (chatLine: LineT, text: string, messageId: string, station: ChatStation) => Promise<void>;

/** Single entry point the dispatcher calls at startup; checks config, starts the listener, wires inbound. */
export async function startGithubBridge(github: GitHubStation, discord: DiscordStation | null, dispatch: Dispatch): Promise<void> {
  if (!github.isConfigured()) return;
  const parentChannelId = process.env.GITHUB_BRIDGE_DISCORD;
  if (!discord || !parentChannelId) { log.warn('github webhook configured but discord + GITHUB_BRIDGE_DISCORD are not — mentions will be dropped'); return; }
  const parent = Line.discord(parentChannelId);
  await github.start();
  github.onMessage(m => void route(m, discord, parent, dispatch)
    .catch((err: unknown) => log.warn({ err: errMsg(err) }, 'github inbound failed')));
}

async function route(m: InboundMessage<GitHubMeta>, discord: DiscordStation, parent: LineT, dispatch: Dispatch): Promise<void> {
  let chatLine = getBridge(m.line) as LineT | undefined;
  if (!chatLine) {
    const created = await createDiscordThread(m, discord, parent).catch(err => {
      log.warn({ err: errMsg(err), github: m.line }, 'github: failed to bootstrap discord thread');
      return null;
    });
    if (!created) return;
    chatLine = created;
    setBridge(m.line, chatLine);
    log.info({ github: m.line, discord: chatLine }, 'github: bridge created');
  }
  /** Each GitHub comment becomes a fresh agent turn in the same chat thread — same continuity model as Discord/Telegram. */
  await dispatch(chatLine, formatForAgent(m), `gh:${m.meta.url}`, discord);
}

async function createDiscordThread(m: InboundMessage<GitHubMeta>, discord: DiscordStation, parent: LineT): Promise<LineT> {
  const kind = m.meta.isPR ? 'PR' : 'Issue';
  const starter = `🔔 **GitHub ${kind}:** [${m.meta.title}](<${m.meta.url}>) — opened by **@${m.meta.authorUsername}**`;
  const starterId = await discord.send(parent, starter);
  const name = `gh#${m.meta.issueNumber} — ${m.meta.title}`.slice(0, 100);
  return discord.createThreadFromMessage(parent, starterId, name);
}

/** First-mention messages include "Issue body:" header so the agent sees full context; follow-ups are just the comment. */
function formatForAgent(m: InboundMessage<GitHubMeta>): string {
  const header = `**@${m.meta.authorUsername}** on GitHub ${m.meta.isPR ? 'PR' : 'issue'} ${m.meta.repoFullName}#${m.meta.issueNumber} (<${m.meta.url}>):`;
  return m.meta.isBootstrap ? `${header}\n\n${m.text}\n\n_(reply here in chat; I'll only post back to GitHub when you ask me to.)_` : `${header}\n\n${m.text}`;
}
