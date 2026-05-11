/** Shared interface across agent backends (Codex, Claude Code). */

/** Tool activity. `transient: true` flags Thinking…/Reasoning… placeholders that vanish on real content. */
export interface ToolActivity {
  kind: string;
  name: string;
  detail?: string;
  transient?: boolean;
}

export interface AgentTurnCallbacks {
  onDelta(text: string): void;
  onToolStart(activity: ToolActivity): void;
  /** `result` is the tool's output text when available (Bash stdout, Read body, …). */
  onToolEnd(kind: string, result?: string): void;
  onComplete(): void;
  onError(err: Error): void;
}

export interface Agent {
  start(): Promise<void>;
  stop(): Promise<void>;
  createThread(): Promise<string>;
  sendTurn(threadId: string, text: string, callbacks: AgentTurnCallbacks): Promise<void>;
}
