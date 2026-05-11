/** Shared types for every metro endpoint — agents (Claude, Codex) and chat platforms (Discord, Telegram, GitHub). */

export interface Attachment {
  mediaType: string;
  data: Buffer;
}

/** Tool activity. `id` pairs start/end uniquely; `transient: true` flags Thinking…/Reasoning… placeholders. */
export interface ToolActivity {
  id: string;
  kind: string;
  name: string;
  detail?: string;
  transient?: boolean;
}

export type Modality = 'text' | 'image';
export type Feature = 'stream' | 'edit' | 'tools' | 'cancel' | 'attachments';

/** Each station declares what it can do; the dispatcher adapts on the seam. */
export interface Capabilities {
  in: Modality[];
  out: Modality[];
  features: Feature[];
}

/** Base for every metro endpoint — chat platforms and agents alike. */
export interface Station {
  readonly name: string;
  readonly capabilities: Capabilities;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** URI-shaped scope identifier — `metro://<station>/<path>`. See docs/uri-scheme.md. */
export type Line = string & { readonly __line: unique symbol };
export const asLine = (s: string): Line => s as Line;

/** Inbound chat message normalized across platforms. `meta` carries platform-specific extras. */
export interface InboundMessage<TMeta = Record<string, unknown>> {
  station: string;
  line: Line;
  messageId: string;
  text: string;
  attachments: Attachment[];
  mentionsBot: boolean;
  meta: TMeta;
}

export interface SendOpts {
  stopId?: string | null;
  replyTo?: string;
}

/** Compute-side station: takes a turn, yields events. Cancel via `signal.abort()`. */
export interface AgentStation extends Station {
  createThread(): Promise<string>;
  sendTurn(req: TurnRequest): AsyncIterable<TurnEvent>;
}

export interface TurnRequest {
  threadId: string;
  text: string;
  attachments: Attachment[];
  signal?: AbortSignal;
}

export type TurnEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool-start'; activity: ToolActivity }
  | { type: 'tool-end'; id: string; result?: string };

/** Chat-side station: receives user messages, posts/edits bot messages. */
export interface ChatStation<TMeta = Record<string, unknown>> extends Station {
  onMessage(handler: (m: InboundMessage<TMeta>) => void): void;
  onStop(handler: (stopId: string) => Promise<boolean>): void;
  send(line: Line, text: string, opts?: SendOpts): Promise<string>;
  edit?(line: Line, messageId: string, text: string, opts?: SendOpts): Promise<void>;
}
