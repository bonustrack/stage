// Shared interface so the orchestrator can talk to either Codex or Claude
// Code (or future agents) through the same surface.

/**
 * A file the user sent alongside their text. Downloaded to a temp path by
 * the channel layer before being handed to the agent so adapters don't need
 * to know how Discord/Telegram delivers blobs.
 *
 * `kind: 'image'` is the only kind both agents accept natively (Claude via
 * stream-json content blocks, Codex via `localImage`). `kind: 'audio'` is
 * surfaced as a note in the prompt text — neither agent ingests audio
 * directly, but exposing the on-disk path lets the agent reach for a
 * transcription tool if one is configured.
 */
export type Attachment = {
  kind: 'image' | 'audio';
  /** Absolute path to the downloaded file. Cleaned up after the turn. */
  path: string;
  mimeType: string;
  /** Display name (original filename when available). */
  name?: string;
};

export interface AgentTurnCallbacks {
  /** Streaming text delta from the agent's response. */
  onDelta(text: string): void;
  /** Tool call started; show a status line (e.g. "Running: ls"). */
  onToolStart(kind: string, summary: string): void;
  /** Tool call ended; clear the status line if it matches. */
  onToolEnd(kind: string): void;
  /** Turn fully complete. */
  onComplete(): void;
  /** Transport / RPC / agent error. */
  onError(err: Error): void;
}

export interface Agent {
  /** Bring up any subprocesses / connections. Called once at startup. */
  start(): Promise<void>;
  /** Tear down everything cleanly on shutdown. */
  stop(): Promise<void>;
  /** Allocate a new agent session and return its id. */
  createThread(): Promise<string>;
  /** Send a user message; stream events back through callbacks. */
  sendTurn(threadId: string, text: string, attachments: Attachment[], callbacks: AgentTurnCallbacks): Promise<void>;
}
