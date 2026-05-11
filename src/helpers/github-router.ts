/** Map a GitHub mention to a Discord thread + run the agent turn there. Bridges persist for follow-up continuity. */

import * as discord from '../channels/discord.js';
import * as github from '../channels/github.js';
import type { GitHubInbound } from '../channels/github.js';
import { errMsg, log } from '../log.js';
import { getBridge, setBridge } from './github-bridges.js';
import { discordChannelFromScopeKey, discordScopeKey } from './scope-cache.js';

export type RouterDeps = {
  parentChannelId: string;
  /** Reuse the existing orchestrator `dispatch` so agent allocation + queue/streaming all stay one path. */
  dispatch: (chatScope: string, text: string, messageId: string, channelId: string) => Promise<void>;
};

/** Single entry point the orchestrator calls at startup; checks config, starts the listener, wires inbound. */
export async function startGithubBridge(discordReady: boolean, deps: Omit<RouterDeps, 'parentChannelId'>): Promise<void> {
  if (!github.isConfigured()) return;
  const parentChannelId = process.env.GITHUB_BRIDGE_DISCORD;
  if (!discordReady || !parentChannelId) { log.warn('github webhook configured but discord + GITHUB_BRIDGE_DISCORD are not — mentions will be dropped'); return; }
  await github.start();
  github.onInbound(m => void routeGithubInbound(m, { ...deps, parentChannelId })
    .catch((err: unknown) => log.warn({ err: errMsg(err) }, 'github inbound failed')));
}

export async function routeGithubInbound(m: GitHubInbound, deps: RouterDeps): Promise<void> {
  let chatScope = getBridge(m.scopeKey);
  let chatChannelId: string | null = chatScope ? discordChannelFromScopeKey(chatScope) : null;
  if (!chatScope || !chatChannelId) {
    const bootstrap = await createDiscordThread(m, deps.parentChannelId).catch(err => {
      log.warn({ err: errMsg(err), scope: m.scopeKey }, 'github: failed to bootstrap discord thread');
      return null;
    });
    if (!bootstrap) return;
    chatScope = bootstrap.scope;
    chatChannelId = bootstrap.channelId;
    setBridge(m.scopeKey, chatScope);
    log.info({ github: m.scopeKey, discord: chatChannelId }, 'github: bridge created');
  }
  /** Each GitHub comment becomes a fresh agent turn in the same thread — same continuity model as Discord/Telegram. */
  await deps.dispatch(chatScope, formatForAgent(m), `gh:${m.url}`, chatChannelId);
}

async function createDiscordThread(m: GitHubInbound, parent: string): Promise<{ scope: string; channelId: string }> {
  const kind = m.isPR ? 'PR' : 'Issue';
  const starter = `🔔 **GitHub ${kind}:** [${m.title}](<${m.url}>) — opened by **@${m.authorUsername}**`;
  const starterId = await discord.sendMessage(parent, starter);
  const name = `gh#${m.issueNumber} — ${m.title}`.slice(0, 100);
  const channelId = await discord.createThreadFromMessage(parent, starterId, name);
  return { scope: discordScopeKey(channelId), channelId };
}

/** First-mention messages include "Issue body:" header so the agent sees full context; follow-ups are just the comment. */
function formatForAgent(m: GitHubInbound): string {
  const header = `**@${m.authorUsername}** on GitHub ${m.isPR ? 'PR' : 'issue'} ${m.repoFullName}#${m.issueNumber} (<${m.url}>):`;
  return m.isBootstrap ? `${header}\n\n${m.text}\n\n_(reply here in chat; I'll only post back to GitHub when you ask me to.)_` : `${header}\n\n${m.text}`;
}
