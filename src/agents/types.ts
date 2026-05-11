/** Shared interface across agent backends (Codex, Claude Code). */

/** Tool activity. `id` pairs start/end uniquely; `transient: true` flags Thinking…/Reasoning… placeholders. */
export interface ToolActivity {
  id: string;
  kind: string;
  name: string;
  detail?: string;
  transient?: boolean;
}

/** Binary attachment from a chat platform (image today; audio/other later). */
export interface Attachment {
  mediaType: string;
  data: Buffer;
}

export interface AgentTurnCallbacks {
  onDelta(text: string): void;
  onToolStart(activity: ToolActivity): void;
  /** `id` matches the start; `result` is the tool's output when available. */
  onToolEnd(id: string, result?: string): void;
  onComplete(): void;
  onError(err: Error): void;
}

export interface Agent {
  start(): Promise<void>;
  stop(): Promise<void>;
  createThread(): Promise<string>;
  sendTurn(threadId: string, text: string, attachments: Attachment[], callbacks: AgentTurnCallbacks): Promise<void>;
}
