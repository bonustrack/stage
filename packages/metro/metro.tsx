#!/usr/bin/env bun
import { useState, useEffect, useRef } from "react";
import { render, Box, Text, Static, useApp, useInput } from "ink";
import TextInput from "ink-text-input";

// ---------- types ----------
type Base = { id: number; running: boolean };
type UserEntry = Base & { kind: "user"; text: string };
type AssistantEntry = Base & { kind: "assistant"; itemId: string; text: string };
type ReasoningEntry = Base & { kind: "reasoning"; itemId: string; text: string };
type ToolEntry = Base & {
  kind: "tool";
  itemId: string;
  label: string;
  output: string;
  ok?: boolean;
};
type ErrorEntry = Base & { kind: "error"; text: string };
type Entry = UserEntry | AssistantEntry | ReasoningEntry | ToolEntry | ErrorEntry;

// ---------- config ----------
let nextId = 0;
const newId = () => nextId++;
const MODEL = process.env.CODEX_MODEL ?? "gpt-5.5";
const EFFORT = process.env.CODEX_EFFORT ?? "low";
const SANDBOX = process.env.CODEX_SANDBOX ?? "workspace-write";
const MAX_TOOL_OUTPUT = 1500;

const truncate = (s: string, max = MAX_TOOL_OUTPUT) =>
  !s ? "" : s.length <= max ? s : s.slice(0, max) + `\n…(${s.length - max} more bytes)`;

// Item-type discriminators that are NOT tool calls (rendered with their own
// kinds or skipped entirely).
const NON_TOOL_TYPES = new Set([
  "agentMessage", "agent_message",
  "reasoning",
  "userMessage", "user_message",
  "hookPrompt", "hook_prompt",
  "contextCompaction", "context_compaction",
]);

function isCommandExec(t: any): boolean {
  return t === "commandExecution" || t === "command_execution";
}
function isAgentMessage(t: any): boolean {
  return t === "agentMessage" || t === "agent_message";
}
function isReasoning(t: any): boolean {
  return t === "reasoning";
}

function labelForItem(it: any): string | null {
  if (!it || typeof it !== "object" || !it.type) return null;
  if (NON_TOOL_TYPES.has(it.type)) return null;

  const t: string = it.type;

  if (isCommandExec(t)) return `$ ${it.command ?? ""}`;
  if (t === "mcpToolCall") return `mcp ${it.server ?? "?"}/${it.tool ?? "?"}`;
  if (t === "dynamicToolCall") {
    return it.namespace ? `${it.namespace}.${it.tool}` : (it.tool ?? "tool");
  }
  if (t === "fileChange") {
    const changes = (it.changes ?? []) as Array<{ path?: string; kind?: string }>;
    if (!changes.length) return "apply_patch";
    const head = changes[0];
    const kindMark = (k?: string) =>
      k === "added" ? "+" : k === "deleted" ? "-" : k === "renamed" ? "→" : "~";
    const more = changes.length > 1 ? ` (+${changes.length - 1} more)` : "";
    return `apply_patch ${kindMark(head.kind)} ${head.path ?? "?"}${more}`;
  }
  if (t === "webSearch") return `web search ${JSON.stringify(it.query ?? "")}`;
  if (t === "plan") return "plan";
  if (t === "imageView") return `view image ${it.path ?? ""}`;
  if (t === "imageGeneration") return "generate image";
  if (t === "collabAgentToolCall") return `collab agent ${it.tool ?? ""}`;

  // Unknown tool-like item — build a best-effort label from common fields so
  // nothing silently disappears from the feed.
  const detail =
    it.command ?? it.tool ?? it.path ?? it.query ?? it.name ?? null;
  return detail ? `${t} · ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : t;
}

function outputForCompletedItem(it: any, prevOutput: string): string {
  if (!it?.type) return prevOutput;
  if (isCommandExec(it.type)) {
    return it.aggregated_output ?? it.aggregatedOutput ?? prevOutput;
  }
  if (it.type === "mcpToolCall") {
    if (it.error?.message) return `error: ${it.error.message}`;
    try { return JSON.stringify(it.result ?? {}, null, 2); }
    catch { return prevOutput; }
  }
  if (it.type === "dynamicToolCall") {
    const items = it.contentItems ?? [];
    if (!items.length) return prevOutput;
    try { return items.map((c: any) => c?.text ?? JSON.stringify(c)).join("\n"); }
    catch { return prevOutput; }
  }
  if (it.type === "fileChange") {
    const changes = (it.changes ?? []) as Array<{ path?: string; kind?: string }>;
    return changes.map(c => `${c.kind ?? "?"} ${c.path ?? ""}`).join("\n");
  }
  if (it.type === "plan") {
    const items = (it.content ?? it.summary ?? []) as string[];
    return items.join("\n");
  }
  return prevOutput;
}

function toolOk(it: any): boolean | undefined {
  if (!it?.type) return undefined;
  if (isCommandExec(it.type)) {
    const code = it.exit_code ?? it.exitCode;
    return typeof code === "number" ? code === 0 : undefined;
  }
  if (it.type === "mcpToolCall") return !it.error;
  if (it.type === "dynamicToolCall") {
    return typeof it.success === "boolean" ? it.success : undefined;
  }
  if (it.type === "fileChange") {
    return it.status === "completed" || it.status === "applied" || it.status === "success";
  }
  return undefined;
}

// ---------- app-server JSON-RPC client ----------
class CodexClient {
  private proc = Bun.spawn(["codex", "app-server"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
  });
  private nextRpcId = 1;
  private pending = new Map<number, (msg: any) => void>();
  private notifHandler: ((msg: any) => void) | null = null;
  private ready: Promise<void>;
  private threadId: string | null = null;

  constructor() {
    this.startReader();
    this.ready = this.handshake();
  }

  private startReader() {
    const reader = this.proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let msg: any;
          try { msg = JSON.parse(line); } catch { continue; }
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const cb = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            cb(msg);
          } else if (msg.method) {
            this.notifHandler?.(msg);
          }
        }
      }
    })();
  }

  private send(o: any) {
    this.proc.stdin.write(JSON.stringify(o) + "\n");
  }

  private request(method: string, params: any): Promise<any> {
    const id = this.nextRpcId++;
    return new Promise((resolve) => {
      this.pending.set(id, (msg) => resolve(msg.result ?? null));
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  private notify(method: string, params?: any) {
    this.send({ jsonrpc: "2.0", method, ...(params ? { params } : {}) });
  }

  private async handshake() {
    await this.request("initialize", {
      clientInfo: { name: "metro", version: "0.1.0" },
    });
    this.notify("initialized");
  }

  onNotification(handler: (msg: any) => void) {
    this.notifHandler = handler;
  }

  async ensureThread(): Promise<string> {
    await this.ready;
    if (this.threadId) return this.threadId;
    const res = await this.request("thread/start", {
      model: MODEL,
      cwd: process.cwd(),
      sandbox: SANDBOX,
    });
    this.threadId = res?.thread?.id ?? null;
    if (!this.threadId) throw new Error("thread/start returned no id");
    return this.threadId;
  }

  async sendUserTurn(text: string) {
    const threadId = await this.ensureThread();
    return this.request("turn/start", {
      threadId,
      effort: EFFORT,
      input: [{ type: "text", text }],
    });
  }

  kill() {
    this.proc.kill();
  }
}

// ---------- view ----------
function EntryView({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case "user":
      return (
        <Box marginTop={1}>
          <Text color="blue" bold>›  </Text>
          <Text color="blue">{entry.text}</Text>
        </Box>
      );
    case "assistant":
      return (
        <Box marginTop={1}>
          <Text>{entry.text}</Text>
          {entry.running && <Text dimColor>▌</Text>}
        </Box>
      );
    case "tool": {
      const color = entry.ok === false ? "red" : "green";
      const marker = entry.running ? "⋯ " : entry.ok === false ? "✗ " : "✓ ";
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color={color}>{marker}{entry.label}</Text>
          {entry.output.trim() && <Text dimColor>{truncate(entry.output)}</Text>}
        </Box>
      );
    }
    case "reasoning":
      return (
        <Box marginTop={1}>
          <Text dimColor italic>thinking · {entry.text}{entry.running ? "▌" : ""}</Text>
        </Box>
      );
    case "error":
      return (
        <Box marginTop={1}>
          <Text color="red">{entry.text}</Text>
        </Box>
      );
  }
}

// ---------- main ----------
function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const itemIndexRef = useRef<Map<string, number>>(new Map());
  const { exit } = useApp();
  const clientRef = useRef<CodexClient | null>(null);

  useInput((_, key) => {
    if (key.escape) exit();
  });

  useEffect(() => {
    const client = new CodexClient();
    clientRef.current = client;
    client.onNotification(handleNotification);
    return () => client.kill();
  }, []);

  function pushEntry(e: Entry, itemId?: string) {
    setEntries(prev => {
      const next = [...prev, e];
      if (itemId) itemIndexRef.current.set(itemId, next.length - 1);
      return next;
    });
  }

  function patchByItemId(itemId: string, mut: (e: Entry) => Entry) {
    const idx = itemIndexRef.current.get(itemId);
    if (idx === undefined) return;
    setEntries(prev => {
      if (idx >= prev.length) return prev;
      const next = prev.slice();
      next[idx] = mut(prev[idx]);
      return next;
    });
  }

  function decodeChunk(s: string): string {
    try { return Buffer.from(s, "base64").toString("utf8"); }
    catch { return s; }
  }

  function handleNotification(msg: any) {
    const m = msg.method as string;
    const p = msg.params ?? {};
    const itemId: string | undefined = p.itemId ?? p.item?.id;

    if (m === "turn/started") { setRunning(true); return; }
    if (m === "turn/completed" || m === "turn/failed") { setRunning(false); return; }

    if (m === "item/started" && p.item) {
      const it = p.item;
      if (itemIndexRef.current.has(it.id)) return;
      if (isAgentMessage(it.type)) {
        pushEntry({
          id: newId(), kind: "assistant", itemId: it.id,
          text: "", running: true,
        }, it.id);
      } else if (isReasoning(it.type)) {
        pushEntry({
          id: newId(), kind: "reasoning", itemId: it.id,
          text: "", running: true,
        }, it.id);
      } else {
        const label = labelForItem(it);
        if (label !== null) {
          pushEntry({
            id: newId(), kind: "tool", itemId: it.id,
            label, output: "", running: true,
          }, it.id);
        }
      }
      return;
    }

    if (m === "item/agentMessage/delta" && itemId) {
      if (!itemIndexRef.current.has(itemId)) {
        pushEntry({
          id: newId(), kind: "assistant", itemId,
          text: p.delta ?? "", running: true,
        }, itemId);
      } else {
        patchByItemId(itemId, e => e.kind === "assistant"
          ? { ...e, text: e.text + (p.delta ?? "") } : e);
      }
      return;
    }

    if ((m === "item/reasoning/textDelta" || m === "item/reasoning/summaryTextDelta") && itemId) {
      if (!itemIndexRef.current.has(itemId)) {
        pushEntry({
          id: newId(), kind: "reasoning", itemId,
          text: p.delta ?? "", running: true,
        }, itemId);
      } else {
        patchByItemId(itemId, e => e.kind === "reasoning"
          ? { ...e, text: e.text + (p.delta ?? "") } : e);
      }
      return;
    }

    if (m === "item/commandExecution/outputDelta" && itemId) {
      const chunk = decodeChunk(p.delta ?? "");
      patchByItemId(itemId, e => e.kind === "tool"
        ? { ...e, output: e.output + chunk } : e);
      return;
    }

    if (m === "item/completed" && p.item) {
      const it = p.item;
      const id = it.id;
      const idx = itemIndexRef.current.get(id);
      if (idx === undefined) {
        // Item completed without a started event — push final entry directly.
        if (isAgentMessage(it.type)) {
          pushEntry({
            id: newId(), kind: "assistant", itemId: id,
            text: it.text ?? "", running: false,
          }, id);
        } else if (isReasoning(it.type)) {
          pushEntry({
            id: newId(), kind: "reasoning", itemId: id,
            text: it.text ?? it.summary ?? "", running: false,
          }, id);
        } else {
          const label = labelForItem(it);
          if (label !== null) {
            pushEntry({
              id: newId(), kind: "tool", itemId: id,
              label,
              output: outputForCompletedItem(it, ""),
              ok: toolOk(it),
              running: false,
            }, id);
          }
        }
        return;
      }
      patchByItemId(id, e => {
        if (isAgentMessage(it.type) && e.kind === "assistant") {
          return { ...e, text: it.text ?? e.text, running: false };
        }
        if (isReasoning(it.type) && e.kind === "reasoning") {
          return { ...e, text: it.text ?? it.summary ?? e.text, running: false };
        }
        if (e.kind === "tool") {
          return {
            ...e,
            label: labelForItem(it) ?? e.label,
            output: outputForCompletedItem(it, e.output),
            ok: toolOk(it),
            running: false,
          };
        }
        return e;
      });
    }
  }

  async function ask(msg: string) {
    pushEntry({ id: newId(), kind: "user", text: msg, running: false });
    setRunning(true);
    try {
      await clientRef.current!.sendUserTurn(msg);
    } catch (err: any) {
      pushEntry({
        id: newId(), kind: "error",
        text: `metro error: ${err?.message ?? err}`,
        running: false,
      });
      setRunning(false);
    }
  }

  function onSubmit(val: string) {
    const msg = val.trim();
    setInput("");
    if (!msg || running) return;
    if (msg === "exit" || msg === "quit") { exit(); return; }
    ask(msg);
  }

  // Split entries: everything except the last gets committed to scrollback via
  // <Static>. The last entry renders inline so it can be re-rendered as deltas
  // arrive. Codex emits items strictly sequentially within a turn, so the last
  // entry is always the only thing currently streaming.
  const head = entries.slice(0, -1);
  const tail = entries.length > 0 ? entries[entries.length - 1] : null;

  return (
    <Box flexDirection="column">
      <Static items={head}>
        {entry => <EntryView key={entry.id} entry={entry} />}
      </Static>
      {tail && <EntryView entry={tail} />}
      <Box marginTop={1}>
        <Text color={running ? "gray" : "blue"} bold>{running ? "⋯  " : "›  "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={onSubmit}
          placeholder={running ? "(working…)" : "ask metro"}
        />
      </Box>
    </Box>
  );
}

render(<App />);
