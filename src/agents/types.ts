// Shared interface so the orchestrator can talk to either Codex or Claude
// Code (or future agents) through the same surface.

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
  sendTurn(threadId: string, text: string, callbacks: AgentTurnCallbacks): Promise<void>;
}
